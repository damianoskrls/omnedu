import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

class CloudinaryFetchRejectedError extends Error {
  constructor(message = 'cloudinary-fetch-rejected') {
    super(message);
    this.name = 'CloudinaryFetchRejectedError';
  }
}

type CloudinaryRef = {
  resourceType: 'image' | 'raw' | 'video';
  deliveryType: 'upload' | 'authenticated' | 'private';
  publicIdWithExt: string;
  publicId: string;
  format: string;
};

@Injectable()
export class StorageService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private parseCloudinaryUrl(storedUrl: string): CloudinaryRef | null {
    try {
      const match = storedUrl.match(/\/(image|raw|video)\/(upload|authenticated|private)\/(?:v\d+\/)?(.+)$/);
      if (!match) return null;
      const resourceType = match[1] as CloudinaryRef['resourceType'];
      const deliveryType = match[2] as CloudinaryRef['deliveryType'];
      const publicIdWithExt = match[3].split('?')[0];
      const dotIdx = publicIdWithExt.lastIndexOf('.');
      const format = dotIdx !== -1 ? publicIdWithExt.slice(dotIdx + 1) : '';
      const publicId = resourceType === 'raw' ? publicIdWithExt : (dotIdx !== -1 ? publicIdWithExt.slice(0, dotIdx) : publicIdWithExt);
      return { resourceType, deliveryType, publicIdWithExt, publicId, format };
    } catch {
      return null;
    }
  }

  /**
   * Build a signed Cloudinary delivery URL from a stored secure_url.
   * Raw public IDs must keep the file extension; image/video IDs must not.
   */
  generateSignedDownloadUrl(storedUrl: string, expiresInSeconds = 3600): string {
    try {
      const parsed = this.parseCloudinaryUrl(storedUrl);
      if (!parsed) return storedUrl;
      const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

      if (parsed.resourceType === 'raw') {
        return cloudinary.url(parsed.publicIdWithExt, {
          resource_type: 'raw',
          type: parsed.deliveryType,
          sign_url: true,
          secure: true,
          expires_at: expiresAt,
        });
      }

      return cloudinary.url(parsed.publicId, {
        resource_type: parsed.resourceType,
        type: parsed.deliveryType,
        ...(parsed.format ? { format: parsed.format } : {}),
        sign_url: true,
        secure: true,
        expires_at: expiresAt,
      });
    } catch {
      return storedUrl;
    }
  }

  private candidateUrls(storedUrl: string): string[] {
    const parsed = this.parseCloudinaryUrl(storedUrl);
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const out: string[] = [storedUrl, this.generateSignedDownloadUrl(storedUrl)];

    if (parsed) {
      for (const type of ['upload', 'authenticated', 'private'] as const) {
        try {
          if (parsed.resourceType === 'raw') {
            out.push(cloudinary.url(parsed.publicIdWithExt, {
              resource_type: 'raw',
              type,
              sign_url: true,
              secure: true,
              expires_at: expiresAt,
            }));
          } else {
            out.push(cloudinary.url(parsed.publicId, {
              resource_type: parsed.resourceType,
              type,
              ...(parsed.format ? { format: parsed.format } : {}),
              sign_url: true,
              secure: true,
              expires_at: expiresAt,
            }));
          }
        } catch {
          // ignore candidate
        }
      }

      try {
        out.push(cloudinary.utils.private_download_url(
          parsed.resourceType === 'raw' ? parsed.publicIdWithExt : parsed.publicId,
          parsed.format || (parsed.resourceType === 'raw' ? '' : 'pdf'),
          {
            resource_type: parsed.resourceType,
            type: parsed.deliveryType,
            expires_at: expiresAt,
            attachment: true,
          },
        ));
      } catch {
        // ignore
      }
    }

    return out.filter((url, index, all) => url && all.indexOf(url) === index && this.isAllowedFetchUrl(url));
  }

  private isAllowedFetchUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      return host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com') || host === 'api.cloudinary.com';
    } catch {
      return false;
    }
  }

  private async readResponseBytes(res: Response): Promise<Buffer> {
    const lengthHeader = res.headers.get('content-length');
    if (lengthHeader && Number(lengthHeader) > MAX_FILE_BYTES) {
      throw new BadGatewayException('Το αρχείο είναι πολύ μεγάλο για λήψη.');
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX_FILE_BYTES) {
      throw new BadGatewayException('Το αρχείο είναι πολύ μεγάλο για λήψη.');
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json') || contentType.includes('text/')) {
      throw new CloudinaryFetchRejectedError();
    }
    if (bytes.byteLength < 64) {
      const text = bytes.toString('utf8');
      if (text.includes('"error"') || text.includes('deny or ACL')) {
        throw new CloudinaryFetchRejectedError();
      }
    }
    return bytes;
  }

  /** Fetch file bytes: try the stored URL, then signed / authenticated Cloudinary URLs. */
  async fetchFile(storedUrl: string): Promise<Buffer> {
    const candidates = this.candidateUrls(storedUrl);
    if (!candidates.length) throw new NotFoundException('Δεν βρέθηκε αρχείο για αυτή την απόδειξη.');

    let lastStatus: number | undefined;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!res.ok) {
          lastStatus = res.status;
          continue;
        }
        return await this.readResponseBytes(res);
      } catch (error) {
        if (error instanceof BadGatewayException || error instanceof NotFoundException) throw error;
        if (error instanceof CloudinaryFetchRejectedError) continue;
        // timeout / network — try next candidate
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
