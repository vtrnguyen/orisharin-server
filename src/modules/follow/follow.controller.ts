import { Controller, Get, Post as HttpPost, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { FollowService } from './follow.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('api/v1/follows')
export class FollowController {
    constructor(private readonly followService: FollowService) { }

    @HttpPost()
    async follow(@Body() body: { followerId: string; followingId: string }) {
        console.log('Body:', body);
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

    @Get('check/:followerId/:followingId')
    async checkFollow(
        @Param('followerId') followerId: string,
        @Param('followingId') followingId: string
    ) {
        return this.followService.isFollowing(followerId, followingId);
    }
}