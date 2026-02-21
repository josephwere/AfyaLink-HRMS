import { WebSocketServer } from 'ws';
import ai from './ai/aiService.js';

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    console.log('WS connection from', req.socket.remoteAddress);
    ws.on('message', async (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'diagnose') {
          const chunks = ['Analyzing symptoms...', 'Consulting knowledge base...', 'Generating suggestions...'];
          for (let i=0;i<chunks.length;i++){
            ws.send(JSON.stringify({ type:'chunk', index:i, chunk:chunks[i] }));
            await new Promise(r=>setTimeout(r,600));
          }
          const out = await ai.diagnose(data.symptoms);
          ws.send(JSON.stringify({ type:'done', result: out }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type:'error', error: err.message }));
      }
    });
  });
  return wss;
}
export default attachWebSocketServer;
