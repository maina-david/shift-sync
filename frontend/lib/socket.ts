import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const SOCKET_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/ws';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const token = typeof window !== 'undefined' ? getAccessToken() : null;

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect_error', () => {
      // connection errors are retried automatically by socket.io
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function reconnectSocket() {
  disconnectSocket();
  return getSocket();
}
