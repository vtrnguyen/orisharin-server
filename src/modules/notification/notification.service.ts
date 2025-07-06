import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema/notification.schema';

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
        return this.notificationModel.find({ userId }).sort({ createdAt: -1 }).exec();
    }

    async markAsRead(id: string) {
        return this.notificationModel.findByIdAndUpdate(id, { isRead: true }, { new: true }).exec();
    }
}