import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema/notification.schema';
import { ppid } from 'process';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>,
    ) { }

    async create(notificationData: Partial<Notification>) {
        return this.notificationModel.create(notificationData);
    }

    async findByUser(userId: string) {
        const notifications = await this.notificationModel
            .find({ recipientId: new Types.ObjectId(userId) })
            .populate('fromUserId', 'fullName username avatarUrl')
            .populate('postId', 'content')
            .sort({ createdAt: -1 })
            .exec();

        return notifications.map(n => {
            const fromUser = n.fromUserId && typeof n.fromUserId === 'object' && 'fullName' in n.fromUserId
                ? n.fromUserId as { fullName?: string; username?: string; avatarUrl?: string }
                : null;
            const post = n.postId && typeof n.postId === 'object' && 'content' in n.postId
                ? n.postId as { content?: string }
                : null;

            return {
                ...n.toObject(),
                senderName: fromUser?.fullName || fromUser?.username || null,
                senderAvatar: fromUser?.avatarUrl || null,
                content: post?.content || null,
            };
        });
    }

    async markAsRead(id: string) {
        return this.notificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true }).exec();
    }

    async markAllAsRead(userId: string) {
        return this.notificationModel.updateMany(
            { recipientId: new Types.ObjectId(userId), isRead: false },
            { $set: { isRead: true } },
        ).exec();
    }
}