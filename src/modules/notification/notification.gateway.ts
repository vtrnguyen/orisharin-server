import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class NotificationGateway {
    @WebSocketServer()
    server: Server;

    sendNotification(recipientId: string, notification: any) {
        this.server.to(`user_${recipientId}`).emit('notification', notification);
    }
}
