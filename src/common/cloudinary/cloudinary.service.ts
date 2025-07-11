import { Injectable, Inject } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable({})
export class CloudinaryService {
    constructor(
        @Inject("Cloudinary")
        private cloudinaryInstance: typeof cloudinary
    ) { }

    async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            this.cloudinaryInstance.uploader.upload_stream(
                { folder: 'orisharin' },
                (error: any, result: any) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(file.buffer);
        });
    }
}
