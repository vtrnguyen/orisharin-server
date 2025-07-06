import { Controller, Get } from "@nestjs/common";

@Controller('accounts')
export class AccountController {
    @Get("test")
    testRoute() {
        return { message: "Account module is working!" };
    }
}
