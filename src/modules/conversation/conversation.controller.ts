import { Controller, Get, Post as HttpPost, Body, Param } from '@nestjs/common';
import { ConversationService } from './conversation.service';

@Controller('api/v1/conversations')
export class ConversationController {
    constructor(private readonly conversationService: ConversationService) { }

    @HttpPost()
    async create(@Body() body) {
        return this.conversationService.create(body);
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