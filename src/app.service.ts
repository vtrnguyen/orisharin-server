import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  helloWorldFromServer(): string {
    return 'Welcome to OriSharin server!';
  }
}
