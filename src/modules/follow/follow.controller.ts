import { Controller, Get, Post as HttpPost, Delete, Param, Body } from '@nestjs/common';
import { FollowService } from './follow.service';

@Controller('api/v1/follows')
export class FollowController {
    constructor(private readonly followService: FollowService) { }

    @HttpPost()
    async follow(@Body() body: { followerId: string; followingId: string }) {
        return this.followService.follow(body.followerId, body.followingId);
    }

    @Delete()
    async unfollow(@Body() body: { followerId: string; followingId: string }) {
        return this.followService.unfollow(body.followerId, body.followingId);
    }

    @Get('followers/:userId')
    async getFollowers(@Param('userId') userId: string) {
        return this.followService.getFollowers(userId);
    }

    @Get('following/:userId')
    async getFollowing(@Param('userId') userId: string) {
        return this.followService.getFollowing(userId);
    }
}