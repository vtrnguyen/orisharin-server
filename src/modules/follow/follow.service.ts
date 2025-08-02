import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema/follow.schema';
import { User, UserDocument } from '../user/schemas/user.schema/user.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';

@Injectable()
export class FollowService {
    constructor(
        @InjectModel(Follow.name)
        private readonly followModel: Model<FollowDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
    ) { }

    async follow(followerId: string, followingId: string) {
        try {
            const follow = await this.followModel.create({ followerId, followingId });

            // increase following for current user
            await this.userModel.findByIdAndUpdate(
                followerId,
                { $inc: { followingCount: 1 } },
            );
            // increase followers for the user being followed
            await this.userModel.findByIdAndUpdate(
                followingId,
                { $inc: { followersCount: 1 } },
            );

            return new ApiResponseDto(follow, "follow successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "follow failed");
        }
    }

    async unfollow(followerId: string, followingId: string) {
        try {
            // delete the connection
            await this.followModel.deleteOne({ followerId, followingId }).exec();
            // decrease followers for current user
            await this.userModel.findByIdAndUpdate(
                followerId,
                { $inc: { followingCount: -1 } },
            );
            // decrease following for the user being followed
            await this.userModel.findByIdAndUpdate(
                followingId,
                { $inc: { followersCount: -1 } },
            );
            return new ApiResponseDto(null, "unfollow successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "unfollow failed");
        }
    }

    async getFollowers(userId: string) {
        return this.followModel.find({ followingId: userId }).exec();
    }

    async getFollowing(userId: string) {
        return this.followModel.find({ followerId: userId }).exec();
    }

    async isFollowing(followerId: string, followingId: string) {
        const exists = await this.followModel.exists({ followerId, followingId });
        return new ApiResponseDto(
            { isFollowing: !!exists },
            !!exists ? "Following" : "Not following",
            true
        );
    }
}