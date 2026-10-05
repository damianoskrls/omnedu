import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private userSocketMap = new Map<string, string>();

  constructor(
    private jwt: JwtService,
    private messages: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      const payload = this.jwt.verify(token) as { sub: string };
      client.data.userId = payload.sub;
      this.userSocketMap.set(payload.sub, client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.userSocketMap.delete(client.data.userId);
    }
  }

  @SubscribeMessage('join-conversation')
  handleJoin(@MessageBody() data: { conversationId: string }, @ConnectedSocket() client: Socket) {
    client.join(`conv:${data.conversationId}`);
  }

  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody() data: { conversationId: string; body: string; mediaUrl?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const msg = await this.messages.sendMessage(
      data.conversationId,
      client.data.userId,
      data.body,
      data.mediaUrl,
    );
    this.server.to(`conv:${data.conversationId}`).emit('new-message', msg);
    return msg;
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.userSocketMap.get(userId);
    if (socketId) this.server.to(socketId).emit(event, data);
  }
}
