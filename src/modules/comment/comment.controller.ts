import { Controller, Get, Post as HttpPost, Body, Param } from '@nestjs/common';
import { CommentService } from './comment.service';

@Controller('comments')
export class CommentController {
    constructor(private readonly commentService: CommentService) { }

    @HttpPost()
    async create(@Body() body) {
        return this.commentService.create(body);
    }

    @Get('post/:postId')
    async getByPost(@Param('postId') postId: string) {
        return this.commentService.findAllByPost(postId);
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.commentService.findById(id);
    }
}