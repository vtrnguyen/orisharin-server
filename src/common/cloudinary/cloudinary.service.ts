import { Injectable, Inject } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable({})
export class CloudinaryService {
    constructor(
        @Inject("Cloudinary")
        private cloudinaryInstance: typeof cloudinary
    ) { }

    async uploadImage(file: Express.Multer.File): Promise<UploadApiResponse> {
        let resourceType: 'image' | 'video' | 'auto' = 'auto';
        if (file.mimetype.startsWith('image/')) resourceType = 'image';
        else if (file.mimetype.startsWith('video/')) resourceType = 'video';

        return new Promise((resolve, reject) => {
            this.cloudinaryInstance.uploader.upload_stream(
                {
                    folder: 'orisharin',
                    resource_type: resourceType,
                },
                (error: any, result: any) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(file.buffer);
        });
    }

    async deleteImage(publicId: string): Promise<any> {
        return this.cloudinaryInstance.uploader.destroy(publicId);
    }
}
