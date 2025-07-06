import { Controller, Get, Post as HttpPost, Body, Param } from '@nestjs/common';
import { MessageService } from './message.service';

@Controller('messages')
export class MessageController {
    constructor(private readonly messageService: MessageService) { }

    @HttpPost()
    async create(@Body() body) {
        return this.messageService.create(body);
    }

    @Get('conversation/:conversationId')
    async getByConversation(@Param('conversationId') conversationId: string) {
        return this.messageService.findByConversation(conversationId);
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.messageService.findById(id);
    }
}