import React, { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Use the same base URL as the REST API client
// @ts-ignore — Vite replaces import.meta.env at build time
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'https://backend.codewyse.site';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        forceUpdate((n) => n + 1);
        setConnected(false);
      }
      return;
    }

    if (socketRef.current) return;

    let cancelled = false;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      const token = await window.electronAPI?.getAuthToken?.();
      if (!token || cancelled) return;
      const s = io(API_BASE_URL, {
        auth: { token },
        transports: ['polling', 'websocket'],
        upgrade: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: Infinity,
        forceNew: true,
      });

      s.on('connect', () => {
        console.log('[Socket] Connected! id:', s.id, 'transport:', s.io.engine?.transport?.name);
        if (!cancelled) setConnected(true);
      });

      s.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected, reason:', reason);
        if (!cancelled) setConnected(false);
      });

      s.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message, 'description:', (err as any).description);
      });

      s.io.on('error', (err) => {
        console.error('[Socket] Transport error:', err);
      });

      heartbeatInterval = setInterval(() => {
        if (s.connected) s.emit('presence:heartbeat');
      }, 60_000);

      if (!cancelled) {
        socketRef.current = s;
        forceUpdate((n) => n + 1);
      } else {
        s.disconnect();
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        forceUpdate((n) => n + 1);
        setConnected(false);
      }
    };
  }, [isAuthenticated]);

  const value = useMemo<SocketContextValue>(
    () => ({ socket: socketRef.current, connected }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketRef.current, connected],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
