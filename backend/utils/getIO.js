let io;
function initIO(server) {
import { Server } from 'socket.io';
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || 'https://your-frontend.com' : 'http://localhost:3000',
      methods: ['GET','POST']
    }
  });
  io.on('connection', socket => {
    console.log('Socket connected', socket.id);
  });
  return io;
}
function getIO() {
  if (!io) throw new Error('IO not initialized');
  return io;
}
export default { initIO, getIO };
