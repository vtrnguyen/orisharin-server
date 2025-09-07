import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' }, namespace: "/" })
@Injectable()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private userSockets = new Map<string, Set<string>>();

    constructor(
        private readonly jwtService: JwtService
    ) { }

    handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token || client.handshake.query?.token;
            if (!token) {
                client.disconnect(true);
                return;
            }

            const payload = this.jwtService.verify(token);
            const userId = payload?.userId || payload?.id;

            if (!userId) {
                client.disconnect(true);
                return;
            }

            // join user to their room
            client.join(`user_${userId}`);

            // track user sockets
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            const sockets = this.userSockets.get(userId);
            if (sockets) {
                sockets.add(client.id);
            }

            client.data.userId = userId;
        } catch (error: any) {
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (!userId) return;

        const socketSet = this.userSockets.get(userId);
        if (socketSet) {
            socketSet.delete(client.id);
            if (socketSet.size === 0) {
                this.userSockets.delete(userId);
            }
        }
    }

    sendNotification(recipientId: string, notification: any) {
        // send to user's room
        this.server.to(`user_${recipientId}`).emit('notification:received', notification);
    }

    @SubscribeMessage('notification:join')
    handleJoinNotification(client: Socket, data: any) {
        const userId = client.data.userId;
        if (userId) {
            client.join(`user_${userId}`);
            client.emit('notification:joined', { success: true });
        }
    }
}
