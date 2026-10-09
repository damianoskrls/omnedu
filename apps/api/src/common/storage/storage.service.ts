import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(file: Express.Multer.File, folder: string, resourceType: 'auto' | 'image' | 'raw' = 'auto'): Promise<string> {
    const raw = resourceType === 'raw' || file.mimetype === 'application/pdf';
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `omnedu/${folder}`,
          resource_type: raw ? 'raw' : resourceType,
          ...(raw ? { use_filename: true, unique_filename: true } : {}),
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result!.secure_url);
        },
      );
      Readable.from(file.buffer).pipe(stream);
    });
  }
}
