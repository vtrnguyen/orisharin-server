import { Controller, Get, Post as HttpPost, Body, Param, UseGuards, Query, UseInterceptors, Patch, UploadedFile } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('api/v1/conversations')
export class ConversationController {
    constructor(private readonly conversationService: ConversationService) { }

    @HttpPost()
    @UseGuards(JwtAuthGuard)
    async create(
        @Body() body: { participantIds: string[], isGroup?: boolean, name?: string },
        @CurrentUser() user: any,
    ) {
        const participantObjectIds = body.participantIds.map(id => new (require('mongoose').Types.ObjectId)(id));
        return this.conversationService.create(
            {
                participantIds: participantObjectIds,
                isGroup: body.isGroup,
                name: body.name,
            },
            user.userId,
        );
    }

    @Get('user/:userId')
    @UseGuards(JwtAuthGuard)
    async getByUser(
        @Param("userId") userId: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @CurrentUser() user: any
    ) {
        if (!user || user.userId !== userId) {
            return { success: false, message: 'Unauthorized', data: null };
        }

        return this.conversationService.findAllByUserPaginated(userId, page, limit);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getById(
        @Param('id') id: string,
        @CurrentUser() user: any
    ) {
        return this.conversationService.getConversationById(id, user?.userId);
    }

    @Patch(":id/avatar")
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor("file"))
    async updateAvatar(
        @Param("id") id: string,
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: any
    ) {
        return this.conversationService.updateAvatar(id, file, user.userId);
    }

    @Patch(":id/name")
    @UseGuards(JwtAuthGuard)
    async updateName(
        @Param("id") id: string,
        @Body() body: { name: string },
        @CurrentUser() user: any
    ) {
        return this.conversationService.updateName(id, body?.name, user.userId);
    }

    @Patch(":id/theme")
    @UseGuards(JwtAuthGuard)
    async updateTheme(
        @Param("id") id: string,
        @Body() body: { theme: string },
        @CurrentUser() user: any
    ) {
        const theme = body?.theme ?? '';
        return this.conversationService.updateTheme(id, theme, user.userId);
    }

    @Patch(":id/participants")
    @UseGuards(JwtAuthGuard)
    async addParticipants(
        @Param("id") id: string,
        @Body() body: { userIds: string[] },
        @CurrentUser() user: any
    ) {
        const userIds = Array.isArray(body.userIds) ? body.userIds : [];
        return this.conversationService.addParticipants(id, userIds, user.userId);
    }

    @Patch(":id/participants/remove")
    @UseGuards(JwtAuthGuard)
    async removeParticipants(
        @Param("id") id: string,
        @Body() body: { userIds: string[] },
        @CurrentUser() user: any
    ) {
        const userIds = Array.isArray(body.userIds) ? body.userIds : [];
        return this.conversationService.removeParticipants(id, userIds, user.userId);
    }

    @Patch(":id/leave")
    @UseGuards(JwtAuthGuard)
    async leaveConversation(
        @Param("id") id: string,
        @CurrentUser() user: any
    ) {
        return this.conversationService.leaveConversation(id, user.userId);
    }
}