import { Controller, Get } from "@nestjs/common";

@Controller('api/v1/accounts')
export class AccountController {
    @Get("test")
    testRoute() {
        return { message: "Account module is working!" };
    }
}
