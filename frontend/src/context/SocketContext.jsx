import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin;
    console.log('[Socket] Bağlanılıyor:', wsUrl);
    const s = io(wsUrl, {
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 15000,
      timeout: 10000,
    });
    s.on('connect', () => {
      s.emit('auth', { token: localStorage.getItem('access_token') });
      if (user?.extension) {
        s.emit('extension:register', { extension: user.extension });
      }
    });
    s.io.on('reconnect_failed', () => {
      console.warn('[Socket] Sunucuya bağlanılamadı, yeniden deneme durduruldu. Ağ ve backend adresini kontrol edin.');
    });
    setSocket(s);
    return () => s?.disconnect();
  }, [user?.id, user?.extension]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
