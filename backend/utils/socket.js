let io;
export const initSocket = (serverIo) => {
  io = serverIo;
  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);
    socket.on('joinRoom', ({room}) => {
      socket.join(room);
    });
    socket.on('leaveRoom', ({room}) => {
      socket.leave(room);
    });
    socket.on('disconnect', () => {
      // handle disconnect
    });
  });
};
export const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};
