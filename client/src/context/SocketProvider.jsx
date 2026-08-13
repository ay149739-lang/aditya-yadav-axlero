import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export default function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { token } = useAuth();

  useEffect(() => {
    const currentToken = token || localStorage.getItem('syncspace_token');
    if (!currentToken) return;

    if (socket && socket.connected) return;

    const newSocket = io('http://localhost:5001', {
      auth: { token: currentToken }
    });
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
