import { Controller, Get, Post as HttpPost, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { LikeService } from './like.service';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { LikeTargetType } from 'src/common/enums/like-target-type.enum';

@Controller('api/v1/likes')
@UseGuards(JwtAuthGuard)
export class LikeController {
    constructor(private readonly likeService: LikeService) { }

    @HttpPost()
    async like(
        @CurrentUser() user: any,
        @Body() body: { targetId: string; type: LikeTargetType }
    ) {
        return this.likeService.like(user.userId, body.targetId, body.type);
    }

    @Delete()
    async unlike(
        @CurrentUser() user: any,
        @Body() body: { targetId: string; type: LikeTargetType }
    ) {
        return this.likeService.unlike(user.userId, body.targetId, body.type);
    }

    @Get()
    async getLikes(
        @Query('targetId') targetId: string,
        @Query('type') type: LikeTargetType,
        @CurrentUser() user: any
    ) {
        return this.likeService.getLikes(targetId, type, user?.userId);
    }
}