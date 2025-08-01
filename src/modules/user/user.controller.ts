import { Controller, Get, Put, Param, Body, UseGuards, UseInterceptors, UploadedFile, Patch } from '@nestjs/common';
import { UserService } from './user.service';
import { IdValidationPipe } from 'common/pipes/id-validation.pipe';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { RolesGuard } from 'common/guards/role.guard';
import { Roles } from 'common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'common/decorators/current-user.decorator';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get()
    @Roles('admin')
    async getAllUsers() {
        return this.userService.findAll();
    }

    @Get(':query')
    async getUserByIdOrUsername(@Param('query') query: string) {
        return this.userService.findByIdOrUsername(query);
    }

    @Patch("profile")
    @UseInterceptors(FileInterceptor("avatar"))
    async updateProfile(
        @UploadedFile() avatar: Express.Multer.File,
        @Body() body: { bio?: string; websiteLinks?: string[] },
        @CurrentUser() user: any
    ) {
        return this.userService.updateProfile(user.id, body, avatar);
    }
}