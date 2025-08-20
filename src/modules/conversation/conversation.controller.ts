import { Controller, Get, Post as HttpPost, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { CurrentUser } from 'common/decorators/current-user.decorator';

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
}