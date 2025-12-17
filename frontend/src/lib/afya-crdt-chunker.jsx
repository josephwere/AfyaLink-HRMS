/**
 * Simple chunking and resumable uploader for binary change arrays.
 * - chunkArrayBuffer(arrayBuffer, chunkSize) => array of Uint8Array chunks
 * - reassembleChunks(chunks) => Uint8Array
 * - create resumable upload metadata (id, totalChunks)
 */
export function chunkArrayBuffer(buf, chunkSize=65536){
  const out = []; for(let i=0;i<buf.byteLength;i+=chunkSize) out.push(new Uint8Array(buf.slice(i, i+chunkSize))); return out;
}
export function reassembleChunks(chunks){
  const total = chunks.reduce((s,c)=>s+c.length,0);
  const res = new Uint8Array(total); let offset=0; for(const c of chunks){ res.set(c, offset); offset += c.length; } return res;
}
export function makeUploadId(){ return 'up_'+Date.now()+'_'+Math.random().toString(36).slice(2,8); }
