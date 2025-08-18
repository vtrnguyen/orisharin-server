import { Controller, Get, Post as HttpPost, Delete, Param, Body, UseGuards, Query } from '@nestjs/common';
import { FollowService } from './follow.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';

@UseGuards(AuthGuard('jwt'))
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
    async getFollowers(
        @Param('userId') userId: string,
        @CurrentUser() user: any
    ) {
        return this.followService.getFollowers(userId, user.userId);
    }

    @Get('following/:userId')
    async getFollowing(
        @Param('userId') userId: string,
        @CurrentUser() user: any
    ) {
        return this.followService.getFollowing(userId, user.userId);
    }

    @Get('check/:followerId/:followingId')
    async checkFollow(
        @Param('followerId') followerId: string,
        @Param('followingId') followingId: string
    ) {
        return this.followService.isFollowing(followerId, followingId);
    }

    @Get('suggest')
    @UseGuards(JwtAuthGuard)
    async suggest(
        @CurrentUser() user: any,
        @Query('q') q?: string,
        @Query('limit') limit = 10,
        @Query('after') after?: string,
    ) {
        return this.followService.suggest(user?.userId, q, Number(limit), after);
    }
}