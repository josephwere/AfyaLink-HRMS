/**
 * AfyaLink CRDT Peer SDK (enhanced)
 * Adds chunking + resumable transfer + acknowledgements over DataChannel.
 *
 * Protocol:
 * - Sender splits each binary change into numbered chunks with a messageId GUID.
 * - Sends { type:'chunk', messageId, index, total, payload: <base64> }
 * - Receiver reassembles chunks per messageId; when complete, sends { type:'ack', messageId }
 * - Sender removes stored chunks on ack; if ack not received within timeout, resumes sending remaining chunks.
 */

import io from 'socket.io-client';
import Automerge from 'automerge';
import localforage from 'localforage';

localforage.config({ name: 'AfyaLinkCRDTPeer' });

function b64Encode(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64Decode(b64){ const s = atob(b64); const arr = new Uint8Array(s.length); for(let i=0;i<s.length;i++) arr[i]=s.charCodeAt(i); return arr.buffer; }
function genId(){ return 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,9); }

export class AfyaPeer {
  constructor({ docId, signalingUrl, token=null, room=null, turnServers=[] }){
    this.docId = docId;
    this.signalingUrl = signalingUrl;
    this.token = token;
    this.room = room || docId;
    this.turnServers = turnServers;
    this.socket = null;
    this.peers = {};
    this.channels = {};
    this.handlers = {};
    this.incomingBuffers = {}; // messageId -> { total, received: Map(index->payload) }
    this.outgoingStore = {}; // messageId -> { chunks, acksReceived: Set(peerId) }
    this.ackTimeout = 15000; // ms
  }

  on(evt, cb){ this.handlers[evt] = cb; }

  async connect(){
    this.socket = io(this.signalingUrl, { auth: { token: this.token } });
    this.socket.on('connect', ()=>{ if(this.room) this.socket.emit('join-room', { room: this.room }); });
    this.socket.on('signal', async ({ from, data }) => { await this._handleSignal(from, data); });
    this.socket.on('peer-joined', ({ id })=>{ this._createOffer(id); });
  }

  async _createOffer(peerId){
    if(this.peers[peerId]) return;
    const pc = new RTCPeerConnection({ iceServers: this.turnServers });
    const dc = pc.createDataChannel('afya-crdt', { ordered: true });
    this._setupChannel(peerId, dc);
    pc.onicecandidate = (e)=>{ if(e.candidate) this.socket.emit('signal', { room: this.room, to: peerId, data: { type:'ice', candidate: e.candidate } }); };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.peers[peerId] = pc;
    this.channels[peerId] = dc;
    this.socket.emit('signal', { room: this.room, to: peerId, data: { type:'offer', sdp: offer.sdp } });
  }

  async _handleSignal(from, data){
    if(data.type === 'offer'){
      const pc = new RTCPeerConnection({ iceServers: this.turnServers });
      pc.ondatachannel = (ev)=> this._setupChannel(from, ev.channel);
      pc.onicecandidate = (e)=>{ if(e.candidate) this.socket.emit('signal', { room: this.room, to: from, data: { type:'ice', candidate: e.candidate } }); };
      await pc.setRemoteDescription({ type:'offer', sdp: data.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.peers[from] = pc;
      this.socket.emit('signal', { room: this.room, to: from, data: { type:'answer', sdp: answer.sdp } });
    } else if(data.type === 'answer'){
      const pc = this.peers[from];
      if(pc) await pc.setRemoteDescription({ type:'answer', sdp: data.sdp });
    } else if(data.type === 'ice'){
      const pc = this.peers[from];
      if(pc) await pc.addIceCandidate(data.candidate);
    }
  }

  _setupChannel(peerId, dc){
    dc.binaryType = 'arraybuffer';
    dc.onopen = ()=> console.log('datachannel open', peerId);
    dc.onmessage = (ev)=> this._handleMessage(peerId, ev.data);
    dc.onclose = ()=> this._cleanupPeer(peerId);
    this.channels[peerId] = dc;
  }

  _cleanupPeer(peerId){
    const pc = this.peers[peerId];
    if(pc) try{ pc.close(); }catch(e){};
    delete this.peers[peerId];
    delete this.channels[peerId];
    if(this.handlers['peer-left']) this.handlers['peer-left'](peerId);
  }

  _handleMessage(peerId, raw){
    try{
      const text = (typeof raw === 'string') ? raw : null;
      const obj = text ? JSON.parse(text) : null;
      if(obj && obj.type === 'chunk'){
        this._handleIncomingChunk(peerId, obj);
      } else if(obj && obj.type === 'ack'){
        this._handleAck(peerId, obj.messageId);
      } else if(obj && obj.type === 'meta' && obj.action === 'changes'){
        if(this.handlers['changes']) this.handlers['changes'](obj);
      } else {
        // binary direct
        if(this.handlers['binary']) this.handlers['binary'](raw);
      }
    }catch(e){
      console.error('message parse error', e);
    }
  }

  _handleIncomingChunk(peerId, obj){
    const { messageId, index, total, payload } = obj;
    if(!this.incomingBuffers[messageId]) this.incomingBuffers[messageId] = { total, received: new Map(), timer: null };
    const buf = b64Decode(payload);
    this.incomingBuffers[messageId].received.set(index, buf);
    // set timeout to clean if incomplete
    clearTimeout(this.incomingBuffers[messageId].timer);
    this.incomingBuffers[messageId].timer = setTimeout(()=>{ delete this.incomingBuffers[messageId]; }, 60*1000);
    // check if complete
    if(this.incomingBuffers[messageId].received.size === total){
      // assemble
      const parts = [];
      for(let i=0;i<total;i++) parts.push(new Uint8Array(this.incomingBuffers[messageId].received.get(i)));
      const joined = new Uint8Array(parts.reduce((s,a)=>s.concat(Array.from(a)), []));
      // notify handler with assembled binary
      if(this.handlers['assembled']) this.handlers['assembled'](messageId, joined.buffer, peerId);
      // send ack back to peer
      const ack = JSON.stringify({ type:'ack', messageId });
      const ch = this.channels[peerId];
      if(ch && ch.readyState === 'open') ch.send(ack);
      delete this.incomingBuffers[messageId];
    }
  }

  _handleAck(peerId, messageId){
    // mark ack received for peer
    if(this.outgoingStore[messageId]){
      this.outgoingStore[messageId].acksReceived = this.outgoingStore[messageId].acksReceived || new Set();
      this.outgoingStore[messageId].acksReceived.add(peerId);
      // if all peers acked, remove store
      const allPeers = Object.keys(this.channels);
      if(allPeers.every(p=> this.outgoingStore[messageId].acksReceived.has(p))){
        delete this.outgoingStore[messageId];
      }
    }
  }

  // send a single binary (Uint8Array) as chunked message
  async sendBinaryToAll(bin){
    const CHUNK_SIZE = 16 * 1024; // 16KB
    const total = Math.ceil(bin.byteLength / CHUNK_SIZE);
    const messageId = genId();
    const chunks = [];
    for(let i=0;i<total;i++){
      const start = i*CHUNK_SIZE, end = Math.min(bin.byteLength, (i+1)*CHUNK_SIZE);
      const part = bin.slice(start, end);
      const b64 = b64Encode(part);
      chunks.push({ messageId, index:i, total, payload: b64 });
    }
    this.outgoingStore[messageId] = { chunks, acksReceived: new Set(), sentAt: Date.now() };
    // send to each peer sequentially with small delay to avoid congestion
    for(const peerId of Object.keys(this.channels)){
      const ch = this.channels[peerId];
      if(!ch || ch.readyState !== 'open') continue;
      for(const c of chunks){
        try{ ch.send(JSON.stringify({ type:'chunk', ...c })); }catch(e){ console.error('send chunk err', e); }
      }
      // start ack timeout/resend monitor for this peer
      this._startAckWatcher(peerId, messageId);
    }
  }

  _startAckWatcher(peerId, messageId){
    const check = async ()=>{
      if(!this.outgoingStore[messageId]) return;
      // if ack not received from peer within ackTimeout, resend missing chunks
      const store = this.outgoingStore[messageId];
      const acks = store.acksReceived || new Set();
      if(acks.has(peerId)) return; // already acked
      // resend all chunks to this peer
      const ch = this.channels[peerId];
      if(ch && ch.readyState === 'open'){
        for(const c of store.chunks){
          try{ ch.send(JSON.stringify({ type:'chunk', ...c })); }catch(e){}
        }
      }
      // schedule another check
      setTimeout(check, this.ackTimeout);
    };
    setTimeout(check, this.ackTimeout);
  }

  // convenience: send Automerge changes (array of Uint8Array) to peers
  async sendChangesToAll(changesArray){
    for(const c of changesArray){
      await this.sendBinaryToAll(c);
    }
  }

  requestPull(){ const payload = JSON.stringify({ type:'meta', action:'pull' }); for(const peerId of Object.keys(this.channels)){ const ch = this.channels[peerId]; if(ch && ch.readyState==='open') ch.send(payload); } }
}
export default AfyaPeer;
