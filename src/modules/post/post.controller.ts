import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { PostService } from "./post.service";

@Controller("api/v1/posts")
export class PostController {
    constructor(private readonly postService: PostService) { }

    @Post()
    async create(@Body() body) {
        return this.postService.create(body);
    }

    @Get()
    async getAll() {
        return this.postService.findAll();
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.postService.findById(id);
    }
}
