import WebSocket, { WebSocketServer } from 'ws';
import { diagnoseSymptoms } from '../services/neuroedgeClient.js';
import jwt from 'jsonwebtoken';
import tokenStore from '../services/tokenStore.js';

export function createAIWebsocket(server, options = {}) {
  const wss = new WebSocketServer({ server, path: '/ws/ai' });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers['sec-websocket-protocol'];
    try {
      if (!token) throw new Error('No token provided');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      if (await tokenStore.isRevoked(token)) {
        ws.close(4001, 'token revoked');
        return;
      }
      ws.user = decoded;
    } catch (err) {
      ws.send(JSON.stringify({ error: 'Unauthorized', detail: err.message }));
      ws.close(4001);
      return;
    }

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { ws.send(JSON.stringify({ error: 'invalid json' })); return; }
      if (msg.type === 'diagnose') {
        const { symptoms } = msg;
        ws.send(JSON.stringify({ event: 'status', data: 'received' }));
        try {
          const res = await diagnoseSymptoms(symptoms);
          if (Array.isArray(res.chunks)) {
            for (const c of res.chunks) { ws.send(JSON.stringify({ event: 'chunk', data: c })); }
            ws.send(JSON.stringify({ event: 'done', data: res }));
          } else {
            const text = JSON.stringify(res);
            const chunkSize = 256;
            for (let i=0;i<text.length;i+=chunkSize){
              ws.send(JSON.stringify({ event: 'chunk', index:i/chunkSize, data: text.slice(i,i+chunkSize) }));
            }
            ws.send(JSON.stringify({ event: 'done', data: res }));
          }
        } catch (err) {
          ws.send(JSON.stringify({ event: 'error', message: err.message }));
        }
      }
    });

    ws.on('close', () => {});

  });

  return wss;
}
