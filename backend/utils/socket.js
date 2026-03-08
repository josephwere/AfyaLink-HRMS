import jwt from "jsonwebtoken";
import CallSession from "../models/CallSession.js";
import Patient from "../models/Patient.js";

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
    socket.on("consultation:join", async ({ callId }) => {
      try {
        if (!callId || !socket.user?.id) return;
        const call = await CallSession.findById(callId).select(
          "_id doctor patient isBlocked deletedAt status metadata"
        );
        if (!call || call.deletedAt || call.isBlocked) {
          socket.emit("consultation:error", { callId, message: "Call is not available." });
          return;
        }
        let patientMatchesUser = false;
        if (call.patient) {
          const patient = await Patient.findById(call.patient).select("metadata.userId");
          patientMatchesUser = String(patient?.metadata?.userId || "") === String(socket.user.id);
        }
        const isParticipant =
          String(call.doctor) === String(socket.user.id) || patientMatchesUser;
        const isPrivileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "DEVELOPER"].includes(
          String(socket.user.role || "").toUpperCase()
        );
        if (!isParticipant && !isPrivileged) {
          socket.emit("consultation:error", { callId, message: "Not allowed to join this consultation." });
          return;
        }
        const roomKey = call.metadata?.roomKey || `call_${String(call._id)}`;
        socket.join(roomKey);
        socket.data.consultationRoom = roomKey;
        socket.emit("consultation:joined", {
          callId: String(call._id),
          roomKey,
          status: call.status,
        });
        socket.to(roomKey).emit("consultation:peer-joined", {
          callId: String(call._id),
          userId: String(socket.user.id),
          role: String(socket.user.role || "").toUpperCase(),
        });
      } catch {
        socket.emit("consultation:error", { callId, message: "Could not join consultation." });
      }
    });
    socket.on("consultation:leave", ({ callId, roomKey }) => {
      const targetRoom = roomKey || socket.data.consultationRoom;
      if (!targetRoom) return;
      socket.leave(targetRoom);
      socket.to(targetRoom).emit("consultation:peer-left", {
        callId: callId ? String(callId) : null,
        userId: socket.user?.id ? String(socket.user.id) : null,
      });
      if (socket.data.consultationRoom === targetRoom) {
        delete socket.data.consultationRoom;
      }
    });
    socket.on("consultation:signal", ({ roomKey, signalType, payload, callId }) => {
      if (!roomKey || !signalType) return;
      socket.to(roomKey).emit("consultation:signal", {
        callId: callId ? String(callId) : null,
        roomKey,
        signalType,
        payload,
        fromUserId: socket.user?.id ? String(socket.user.id) : null,
      });
    });
    socket.on("consultation:chat", ({ roomKey, callId, message }) => {
      const text = String(message || "").trim();
      if (!roomKey || !text) return;
      const payload = {
        callId: callId ? String(callId) : null,
        roomKey,
        message: text.slice(0, 2000),
        fromUserId: socket.user?.id ? String(socket.user.id) : null,
        fromRole: socket.user?.role ? String(socket.user.role).toUpperCase() : null,
        sentAt: new Date().toISOString(),
      };
      io.to(roomKey).emit("consultation:chat", payload);
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
