import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function connectSocket(userId: string): void {
  const s = getSocket();
  if (s.connected) {
    // Already connected — just join the room
    s.emit('join', userId);
  } else {
    // Wait for connection before emitting join
    s.once('connect', () => {
      s.emit('join', userId);
    });
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
