import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Post, PostDocument } from "./schemas/post.schema/post.schema";
import { read } from "fs";
import { Model } from "mongoose";

@Injectable()
export class PostService {
    constructor(
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
    ) { }

    async create(postData: Partial<Post>) {
        return this.postModel.create(postData);
    }

    async findAll() {
        return this.postModel.find().populate('authorId').exec();
    }

    async findById(id: string) {
        return this.postModel.findById(id).exec();
    }
}
