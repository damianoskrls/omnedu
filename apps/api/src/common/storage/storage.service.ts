import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

@Injectable()
export class StorageService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Build a signed Cloudinary delivery URL from a stored secure_url.
   * Raw public IDs must keep the file extension; image/video IDs must not.
   */
  generateSignedDownloadUrl(storedUrl: string, expiresInSeconds = 3600): string {
    try {
      const match = storedUrl.match(/\/(image|raw|video)\/(upload|authenticated|private)\/(?:v\d+\/)?(.+)$/);
      if (!match) return storedUrl;
      const resourceType = match[1] as 'image' | 'raw' | 'video';
      const deliveryType = match[2] as 'upload' | 'authenticated' | 'private';
      const publicIdWithExt = match[3];
      const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

      if (resourceType === 'raw') {
        return cloudinary.url(publicIdWithExt, {
          resource_type: 'raw',
          type: deliveryType,
          sign_url: true,
          secure: true,
          expires_at: expiresAt,
        });
      }

      const dotIdx = publicIdWithExt.lastIndexOf('.');
      const format = dotIdx !== -1 ? publicIdWithExt.slice(dotIdx + 1) : '';
      const publicId = dotIdx !== -1 ? publicIdWithExt.slice(0, dotIdx) : publicIdWithExt;

      return cloudinary.url(publicId, {
        resource_type: resourceType,
        type: deliveryType,
        ...(format ? { format } : {}),
        sign_url: true,
        secure: true,
        expires_at: expiresAt,
      });
    } catch {
      return storedUrl;
    }
  }

  private isAllowedFetchUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com');
    } catch {
      return false;
    }
  }

  /** Fetch file bytes: try the stored URL, then a correctly signed Cloudinary URL. */
  async fetchFile(storedUrl: string): Promise<Buffer> {
    const candidates = [storedUrl, this.generateSignedDownloadUrl(storedUrl)].filter(
      (url, index, all) => url && all.indexOf(url) === index && this.isAllowedFetchUrl(url),
    );
    if (!candidates.length) throw new NotFoundException('Δεν βρέθηκε αρχείο για αυτή την απόδειξη.');

    let lastStatus: number | undefined;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) {
          lastStatus = res.status;
          continue;
        }
        const lengthHeader = res.headers.get('content-length');
        if (lengthHeader && Number(lengthHeader) > MAX_FILE_BYTES) {
          throw new BadGatewayException('Το αρχείο είναι πολύ μεγάλο για λήψη.');
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.byteLength > MAX_FILE_BYTES) {
          throw new BadGatewayException('Το αρχείο είναι πολύ μεγάλο για λήψη.');
        }
        return bytes;
      } catch (error) {
        if (error instanceof BadGatewayException) throw error;
        // try next candidate (timeout / network)
      }
    }

    if (lastStatus === 404) throw new NotFoundException('Δεν βρέθηκε αρχείο για αυτή την απόδειξη.');
    throw new BadGatewayException('Δεν ήταν δυνατή η λήψη του αρχείου.');
  }

  async upload(file: Express.Multer.File, folder: string, resourceType: 'auto' | 'image' | 'raw' = 'auto'): Promise<string> {
    const raw = resourceType === 'raw' || file.mimetype === 'application/pdf';
    const rawExt = raw ? (file.originalname.split('.').pop()?.toLowerCase() || undefined) : undefined;
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `omnedu/${folder}`,
          resource_type: raw ? 'raw' : resourceType,
          ...(raw ? { use_filename: true, unique_filename: true, access_mode: 'public', ...(rawExt ? { format: rawExt } : {}) } : {}),
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
