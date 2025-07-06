import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Like, LikeDocument } from './schemas/like.schema/like.schema';

@Injectable()
export class LikeService {
    constructor(
        @InjectModel(Like.name)
        private readonly likeModel: Model<LikeDocument>,
    ) { }

    async like(data: Partial<Like>) {
        return this.likeModel.create(data);
    }

    async unlike(userId: string, targetId: string, type: string) {
        return this.likeModel.deleteOne({ userId, targetId, type }).exec();
    }

    async getLikes(targetId: string, type: string) {
        return this.likeModel.find({ targetId, type }).exec();
    }
}