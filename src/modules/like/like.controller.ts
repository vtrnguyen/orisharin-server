import { Controller, Get, Post as HttpPost, Delete, Body, Param, Query } from '@nestjs/common';
import { LikeService } from './like.service';
import { Types } from 'mongoose';

@Controller('api/v1/likes')
export class LikeController {
    constructor(private readonly likeService: LikeService) { }

    @HttpPost()
    async like(@Body() body: { userId: string; targetId: string; type: string }) {
        const likeData = {
            userId: new Types.ObjectId(body.userId),
            targetId: new Types.ObjectId(body.targetId),
            type: body.type
        };
        return this.likeService.like(likeData);
    }

    @Delete()
    async unlike(@Body() body: { userId: string; targetId: string; type: string }) {
        return this.likeService.unlike(body.userId, body.targetId, body.type);
    }

    @Get()
    async getLikes(@Query('targetId') targetId: string, @Query('type') type: string) {
        return this.likeService.getLikes(targetId, type);
    }
}