import { Controller, Get, Post as HttpPost, Body, Param, UseGuards } from '@nestjs/common';
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
    async getByUser(@Param('userId') userId: string) {
        return this.conversationService.findByUser(userId);
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.conversationService.findById(id);
    }
}