import jwt from "jsonwebtoken";

let io;
export const initSocket = (serverIo) => {
  io = serverIo;
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake?.auth?.token ||
        socket.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!token) return next();
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
      );
      socket.user = decoded;
      return next();
    } catch {
      return next();
    }
  });
  io.on('connection', (socket) => {
    console.log('Socket connected', socket.id);
    socket.on('joinRoom', ({room}) => {
      socket.join(room);
    });
    socket.on('leaveRoom', ({room}) => {
      socket.leave(room);
    });
    socket.on("communication:join", ({ channelId }) => {
      if (!channelId) return;
      socket.join(`channel:${String(channelId)}`);
    });
    socket.on("communication:leave", ({ channelId }) => {
      if (!channelId) return;
      socket.leave(`channel:${String(channelId)}`);
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
