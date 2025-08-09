import { Controller, Get, Post as HttpPost, Body, Param, Patch, UseGuards, Delete } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @HttpPost()
    async create(@Body() body) {
        return this.notificationService.create(body);
    }

    @Get('me')
    async getMyNotifications(@CurrentUser() user: any) {
        return this.notificationService.findByUser(user.userId);
    }

    @Patch(':id/read')
    async markAsRead(@Param('id') id: string) {
        return this.notificationService.markAsRead(id);
    }

    @Patch("me/read-all")
    async markAlLAsRead(@CurrentUser() user: any) {
        return this.notificationService.markAllAsRead(user.userId);
    }

    @Delete(':id')
    async deleteById(@Param("id") id: string) {
        return this.notificationService.deleteById(id);
    }

    @Delete("me/all")
    async deleteAllByUserId(@CurrentUser() user: any) {
        return this.notificationService.deleteAllByUserId(user.userId);
    }
}