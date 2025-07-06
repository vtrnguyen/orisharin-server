import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema/follow.schema';

@Injectable()
export class FollowService {
    constructor(
        @InjectModel(Follow.name)
        private readonly followModel: Model<FollowDocument>,
    ) { }

    async follow(followerId: string, followingId: string) {
        return this.followModel.create({ followerId, followingId });
    }

    async unfollow(followerId: string, followingId: string) {
        return this.followModel.deleteOne({ followerId, followingId }).exec();
    }

    async getFollowers(userId: string) {
        return this.followModel.find({ followingId: userId }).exec();
    }

    async getFollowing(userId: string) {
        return this.followModel.find({ followerId: userId }).exec();
    }
}