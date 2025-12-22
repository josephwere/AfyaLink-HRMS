import http from 'http';
import dotenv from 'dotenv';
import { Server as IOServer } from 'socket.io';

import connectDB from './config/db.js';
import app from './app.js';
import { initSocket } from './utils/socket.js';

import dlqScheduler from './services/dlqScheduler.js';
import attachWebSocketServer from './wsServer.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// =======================================================
// ✅ SAFE SOCKET.IO CORS (MATCHES EXPRESS CORS)
// =======================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://afya-link-hrms-frontend-4.vercel.app',
].filter(Boolean);
// =======================================================

const start = async () => {
  try {
    // Connect database
    await connectDB();

    // Create HTTP Express server
    const server = http.createServer(app);

    // Setup WebSocket server (COOKIE + AUTH SAFE)
    const io = new IOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Socket.IO CORS blocked: ${origin}`));
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
      },
    });

    // Initialize socket handlers
    initSocket(io);

    // Start backend server
    server.listen(PORT, () => {
      console.log(`\n🚀 AfyaLink HRMS backend running on port ${PORT}`);
      console.log(`🌐 Allowed Origins:`, allowedOrigins, '\n');
    });

  } catch (err) {
    console.error('❌ Failed to start server', err);
    process.exit(1);
  }
};

start();
