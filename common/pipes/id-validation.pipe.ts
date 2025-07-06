import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

@Injectable()
export class IdValidationPipe implements PipeTransform {
    transform(value: string) {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException('Invalid Id format');
        }
        return value;
    }
}