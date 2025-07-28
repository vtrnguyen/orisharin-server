import { Body, Controller, Get, Param, Post, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { PostService } from "./post.service";
import { JwtAuthGuard } from "common/guards/jwt-auth.guard";
import { CurrentUser } from "common/decorators/current-user.decorator";
import { FilesInterceptor } from "@nestjs/platform-express";

@Controller("api/v1/posts")
export class PostController {
    constructor(
        private readonly postService: PostService
    ) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FilesInterceptor("files"))
    async create(
        @CurrentUser() user: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() body: {
            content: string;
            privacy?: 'public' | 'followers' | 'private';
            originalPostId?: string;
            sharedFromPostId?: string;
        }
    ) {
        return this.postService.create(user.userId, body, files);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async getAll() {
        return this.postService.findAll();
    }

    @Get('user/:username')
    @UseGuards(JwtAuthGuard)
    async getByUsername(@Param('username') username: string) {
        return this.postService.findByUsername(username);
    }
}

