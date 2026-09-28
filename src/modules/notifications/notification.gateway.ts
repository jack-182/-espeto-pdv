import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

export interface RealTimeNotification {
  type: string;
  level: string;
  title: string;
  message: string;
  storeId?: string;
  sessionId?: string;
  desvios?: any;
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
@Injectable()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userConnections = new Map<string, Set<string>>(); // tenantId -> Set<socketIds>

  /**
   * Quando cliente conecta
   */
  handleConnection(client: Socket) {
    const tenantId = client.handshake.auth.tenantId;

    if (!tenantId) {
      client.disconnect();
      return;
    }

    // Registrar conexão
    if (!this.userConnections.has(tenantId)) {
      this.userConnections.set(tenantId, new Set());
    }
    this.userConnections.get(tenantId)!.add(client.id);

    console.log(`[WS] Cliente conectado: ${client.id} | Tenant: ${tenantId}`);
  }

  /**
   * Quando cliente desconecta
   */
  handleDisconnect(client: Socket) {
    const tenantId = client.handshake.auth.tenantId;

    if (tenantId && this.userConnections.has(tenantId)) {
      this.userConnections.get(tenantId)!.delete(client.id);
      if (this.userConnections.get(tenantId)!.size === 0) {
        this.userConnections.delete(tenantId);
      }
    }

    console.log(`[WS] Cliente desconectado: ${client.id}`);
  }

  /**
   * Subscribe a notificações de um tenant (dono)
   */
  @SubscribeMessage('subscribe-alerts')
  subscribeToAlerts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    client.join(`alerts:${data.tenantId}`);
    console.log(`[WS] Cliente ${client.id} se inscreveu em alertas do tenant ${data.tenantId}`);
  }

  /**
   * Unsubscribe
   */
  @SubscribeMessage('unsubscribe-alerts')
  unsubscribeFromAlerts(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    client.leave(`alerts:${data.tenantId}`);
  }

  /**
   * Broadcast notificação para o dono (apenas ele recebe)
   * Este é o método chamado pelo AlertService
   */
  broadcastToOwner(tenantId: string, notification: RealTimeNotification) {
    const room = `alerts:${tenantId}`;

    this.server.to(room).emit('notification', {
      id: Math.random().toString(36),
      ...notification,
    });

    console.log(
      `[WS] 🚨 Broadcast para owner ${tenantId}: ${notification.title}`,
    );
  }

  /**
   * Broadcast para uma loja específica (gerentes da loja)
   */
  broadcastToStore(tenantId: string, storeId: string, notification: RealTimeNotification) {
    const room = `store:${tenantId}:${storeId}`;

    this.server.to(room).emit('notification', {
      id: Math.random().toString(36),
      ...notification,
    });

    console.log(
      `[WS] Broadcast para loja ${storeId}: ${notification.title}`,
    );
  }

  /**
   * Health check
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date() });
  }
}
