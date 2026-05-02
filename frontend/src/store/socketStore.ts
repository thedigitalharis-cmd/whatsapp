import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: (token: string, organizationId: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  connect: (token, organizationId) => {
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = io(process.env.REACT_APP_WS_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join:organization', organizationId);
      set({ isConnected: true });
    });

    socket.on('disconnect', () => set({ isConnected: false }));

    set({ socket });
  },
  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, isConnected: false });
  },
}));
