import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { PostService } from "./post.service";
import { JwtAuthGuard } from "common/guards/jwt-auth.guard";
import { CurrentUser } from "common/decorators/current-user.decorator";

@Controller("api/v1/posts")
export class PostController {
    constructor(private readonly postService: PostService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    async create(
        @CurrentUser() user: any,
        @Body() body: {
            content: string;
            mediaUrls?: string[];
            privacy?: 'public' | 'followers' | 'private';
            originalPostId?: string;
            sharedFromPostId?: string;
        }
    ) {
        return this.postService.create(
            user.userId,
            body
        );
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async getAll() {
        return this.postService.findAll();
    }

    @Get(':id')
    async getById(@Param('id') id: string) {
        return this.postService.findById(id);
    }
}

