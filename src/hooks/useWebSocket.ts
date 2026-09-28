import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';

export const useWebSocket = (channel: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [data, setData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const { tenant } = useTenant();

  useEffect(() => {
    if (!user || !tenant?.tenantId) return;

    // Conectar ao WebSocket
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
      auth: {
        tenantId: tenant.tenantId,
        token: user.accessToken,
      },
    });

    newSocket.on('connect', () => {
      console.log('[WS] Conectado ao servidor');
      setIsConnected(true);

      // Se conectou, se inscrever no canal
      if (channel) {
        newSocket.emit('subscribe-alerts', { tenantId: tenant.tenantId });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('[WS] Desconectado');
      setIsConnected(false);
    });

    // Escutar notificações
    newSocket.on('notification', (payload) => {
      console.log('[WS] Notificação recebida:', payload);
      setData(payload);
    });

    // Health check
    newSocket.on('pong', (payload) => {
      console.log('[WS] Pong:', payload);
    });

    newSocket.on('error', (error) => {
      console.error('[WS] Erro:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, tenant, channel]);

  return { socket, data, isConnected };
};
