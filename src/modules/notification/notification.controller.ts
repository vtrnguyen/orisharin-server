import { Controller, Get, Post as HttpPost, Body, Param, Patch } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @HttpPost()
    async create(@Body() body) {
        return this.notificationService.create(body);
    }

    @Get('user/:userId')
    async getByUser(@Param('userId') userId: string) {
        return this.notificationService.findByUser(userId);
    }

    @Patch(':id/read')
    async markAsRead(@Param('id') id: string) {
        return this.notificationService.markAsRead(id);
    }
}