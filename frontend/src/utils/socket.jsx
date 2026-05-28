import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getAccessToken } from "./browserSession";
import {
  assertSecureApiBase,
  getRuntimeConfiguredApiBase,
  resolveApiBase,
} from "./networkBase";

const SocketContext = createContext(undefined);

export default function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const SOCKET_URL =
      resolveApiBase(import.meta.env.VITE_SOCKET_URL || getRuntimeConfiguredApiBase() || "");
    assertSecureApiBase(SOCKET_URL);

    const s = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: {
        token, // 🔐 JWT sent to backend
      },
    });

    setSocket(s);

    s.on("connect", () => {
      console.log("🔌 Socket connected:", s.id);
    });

    s.on("disconnect", () => {
      console.log("❌ Socket disconnected");
    });

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (ctx === undefined) {
    console.warn("useSocket used outside SocketProvider");
  }
  return ctx;
};
