import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema/notification.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel(Notification.name)
        private readonly notificationModel: Model<NotificationDocument>,
    ) { }

    async create(notificationData: Partial<Notification>) {
        const notification = await this.notificationModel.create(notificationData);

        const populatedNotification = await this.notificationModel
            .findById(notification._id)
            .populate('fromUserId', 'fullName username avatarUrl')
            .populate('postId', 'content')
            .exec();

        if (!populatedNotification) {
            return notification;
        }

        const fromUser = populatedNotification.fromUserId && typeof populatedNotification.fromUserId === 'object' && 'fullName' in populatedNotification.fromUserId
            ? populatedNotification.fromUserId as { fullName?: string; username?: string; avatarUrl?: string }
            : null;
        const post = populatedNotification.postId && typeof populatedNotification.postId === 'object' && 'content' in populatedNotification.postId
            ? populatedNotification.postId as { content?: string }
            : null;

        return {
            ...populatedNotification.toObject(),
            senderName: fromUser?.fullName || fromUser?.username || null,
            senderAvatar: fromUser?.avatarUrl || null,
            content: post?.content || null,
        };
    }

    async findByUser(userId: string) {
        try {
            const notifications = await this.notificationModel
                .find({ recipientId: new Types.ObjectId(userId) })
                .populate('fromUserId', 'fullName username avatarUrl')
                .populate('postId', 'content')
                .sort({ createdAt: -1 })
                .exec();

            const mapped = notifications.map(n => {
                const fromUser = n.fromUserId && typeof n.fromUserId === 'object' && 'fullName' in n.fromUserId
                    ? n.fromUserId as { fullName?: string; username?: string; avatarUrl?: string }
                    : null;
                const post = n.postId && typeof n.postId === 'object' && 'content' in n.postId
                    ? n.postId as { content?: string }
                    : null;

                return {
                    ...n.toObject(),
                    senderName: fromUser?.fullName || null,
                    senderUsername: fromUser?.username || null,
                    senderAvatar: fromUser?.avatarUrl || null,
                    content: post?.content || null,
                };
            });

            return new ApiResponseDto(mapped, "Get notifications successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error?.message, false, "Get notifications failed");
        }
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

    async deleteById(id: string) {
        try {
            const result = await this.notificationModel.findByIdAndDelete(id).exec();
            const success = !!result;
            const message = success ? "Delete notification successfully" : "Notification not found";
            return new ApiResponseDto(result, message, success);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Delete notification failed");
        }
    }

    async deleteAllByUserId(userId: string) {
        try {
            const result = await this.notificationModel.deleteMany({
                recipientId: new Types.ObjectId(userId)
            }).exec();
            return new ApiResponseDto(result, "Delete all notifications successfully");
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Delete all notifications failed");
        }
    }
}