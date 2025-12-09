import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { MessageService } from "./message.service";

@WebSocketGateway({ cors: { origin: '*' }, namespace: "/" })
@Injectable()
export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private userSockets = new Map<string, Set<string>>();

    constructor(
        private readonly messageService: MessageService,
        private readonly jwtService: JwtService
    ) { }

    handleConnection(client: any, ...args: any[]) {
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

            // register socket
            if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
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

        const set = this.userSockets.get(userId);
        if (set) {
            set.delete(client.id);
            if (set.size === 0) this.userSockets.delete(userId);
        }
    }

    @SubscribeMessage('message:send')
    async handleSendMessage(client: Socket, payload: { conversationId: string; content?: string; mediaUrls?: string[] }) {
        const senderId = client.data.userId;

        // validate membership - implement in messageService
        const allowed = await this.messageService.isParticipant(payload.conversationId, senderId);
        if (!allowed) {
            client.emit('message:error', { message: 'Not a participant' });
            return;
        }

        const { Types } = require('mongoose');
        const result = await this.messageService.create({
            conversationId: new Types.ObjectId(payload.conversationId),
            senderId: new Types.ObjectId(senderId),
            content: payload.content,
            mediaUrls: payload.mediaUrls || [],
            sentAt: new Date(),
        });

        const participantIds = await this.messageService.getParticipants(payload.conversationId);

        if (Array.isArray(result)) {
            for (const singleMsg of result) {
                for (const pid of participantIds) {
                    const sockets = this.userSockets.get(pid.toString());
                    if (sockets) {
                        for (const sid of sockets) {
                            this.server.to(sid).emit('message:created', singleMsg);
                        }
                    }
                }
            }
            return;
        }

        for (const pid of participantIds) {
            const sockets = this.userSockets.get(pid.toString());
            if (sockets) {
                for (const sid of sockets) {
                    this.server.to(sid).emit('message:created', result);
                }
            }
        }
    }

    public async broadcastMessageToConversation(conversationId: string, message: any) {
        const participantIds = await this.messageService.getParticipants(conversationId);

        const messages = Array.isArray(message) ? message : [message];

        for (const msg of messages) {
            for (const pid of participantIds) {
                const sockets = this.userSockets.get(pid.toString());
                if (sockets) {
                    for (const sid of sockets) {
                        this.server.to(sid).emit('message:created', msg);
                    }
                }
            }
        }
    }

    public async broadcastMessageDeleted(conversationId: string, messageId: string) {
        const participantIds = await this.messageService.getParticipants(conversationId);
        for (const pid of participantIds) {
            const sockets = this.userSockets.get(pid.toString());
            if (sockets) {
                for (const sid of sockets) {
                    this.server.to(sid).emit('message:deleted', { id: messageId });
                }
            }
        }
    }

    public async broadCastMessageReacted(conversationId: string, payload: { messageId: string; userId: string; user?: any; type: string | null; reactionsCount: any }) {
        const participantIds = await this.messageService.getParticipants(conversationId);
        for (const pid of participantIds) {
            const sockets = this.userSockets.get(pid.toString());
            if (sockets) {
                for (const sid of sockets) {
                    this.server.to(sid).emit("message:reacted", payload);
                }
            }
        }
    }
}