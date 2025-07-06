import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { IdValidationPipe } from 'common/pipes/id-validation.pipe';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { CurrentUser } from 'common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get()
    async getAllUsers() {
        return this.userService.findAll();
    }

    @Get('profile')
    async getProfile(@CurrentUser() user: any) {
        return this.userService.findById(user.id);
    }

    @Get(':id')
    async getUserById(@Param('id', IdValidationPipe) id: string) {
        return this.userService.findById(id);
    }

    @Put(':id')
    async updateUser(@Param('id', IdValidationPipe) id: string, @Body() body) {
        return this.userService.update(id, body);
    }
}