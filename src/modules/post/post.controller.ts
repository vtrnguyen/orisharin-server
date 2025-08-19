import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
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

    @Delete(":id")
    @UseGuards(JwtAuthGuard)
    async deletePost(
        @Param("id") id: string,
        @CurrentUser() user: any,
    ) {
        return this.postService.delete(id, user.userId);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async getAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
        return this.postService.findAllPaginated(Number(page), Number(limit));
    }

    @Get("user/:username/post/:id")
    @UseGuards(JwtAuthGuard)
    async getPostDetail(
        @Param("username") username: string,
        @Param("id") id: string,
    ) {
        return this.postService.getPostDetail(username, id);
    }

    @Get("user/:username/deleted")
    @UseGuards(JwtAuthGuard)
    async getDeletedByUsername(
        @Param("username") username: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @CurrentUser() user: any
    ) {
        return this.postService.findDeletedByUserPaginated(username, Number(page), Number(limit), user?.userId);
    }

    @Get('user/:username')
    @UseGuards(JwtAuthGuard)
    async getByUsername(
        @Param('username') username: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10
    ) {
        return this.postService.findAllByUserPaginated(username, Number(page), Number(limit));
    }

    @Post(":id/restore")
    @UseGuards(JwtAuthGuard)
    async restorePost(
        @Param("id") id: string,
        @CurrentUser() user: any
    ) {
        return this.postService.restore(id, user.userId);
    }

    @Delete(":id/permanent")
    @UseGuards(JwtAuthGuard)
    async permanentDeletePost(
        @Param("id") id: string,
        @CurrentUser() user: any
    ) {
        return this.postService.permanentlyDelete(id, user.userId);
    }
}

