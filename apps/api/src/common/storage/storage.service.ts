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

  generateSignedDownloadUrl(storedUrl: string, expiresInSeconds = 3600): string {
    try {
      const match = storedUrl.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/);
      if (!match) return storedUrl;
      const publicIdWithExt = match[1];
      const dotIdx = publicIdWithExt.lastIndexOf('.');
      const format = dotIdx !== -1 ? publicIdWithExt.slice(dotIdx + 1) : '';
      const publicId = dotIdx !== -1 ? publicIdWithExt.slice(0, dotIdx) : publicIdWithExt;
      const resourceType = storedUrl.includes('/raw/upload/') ? 'raw' : storedUrl.includes('/video/upload/') ? 'video' : 'image';

      return cloudinary.url(publicId, {
        resource_type: resourceType as 'raw' | 'image' | 'video',
        format,
        sign_url: true,
        type: 'upload',
        expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
      });
    } catch {
      return storedUrl;
    }
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
