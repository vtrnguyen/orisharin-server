import { Controller, Get, Post as HttpPost, Body, Param, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { CommentService } from './comment.service';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('api/v1/comments')
export class CommentController {
    constructor(private readonly commentService: CommentService) { }

    @HttpPost()
    @UseInterceptors(FilesInterceptor('files'))
    async create(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() body: any
    ) {
        return this.commentService.create(body, files);
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