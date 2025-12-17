/* Simple chunked/resumable transfer helpers for ArrayBuffer chunks */
export function splitToChunks(uint8arr, chunkSize=64*1024){
  const chunks=[];
  for(let i=0;i<uint8arr.length;i+=chunkSize){
    chunks.push(uint8arr.slice(i, i+chunkSize));
  }
  return chunks;
}

export function concatChunks(chunks){
  const total = chunks.reduce((s,c)=> s + c.length, 0);
  const out = new Uint8Array(total);
  let offset=0;
  for(const c of chunks){ out.set(c, offset); offset += c.length; }
  return out;
}
