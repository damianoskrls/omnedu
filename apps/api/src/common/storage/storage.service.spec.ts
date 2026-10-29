import { StorageService } from './storage.service';

describe('StorageService.generateSignedDownloadUrl', () => {
  let service: StorageService;

  beforeAll(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = '123456789012345';
    process.env.CLOUDINARY_API_SECRET = 'abcdefghijklmnopqrstuvwxyz12';
    service = new StorageService();
  });

  it('keeps the .pdf extension in raw public IDs', () => {
    const stored = 'https://res.cloudinary.com/demo/raw/upload/v1234567890/omnedu/documents/receipt_abc.pdf';
    const signed = service.generateSignedDownloadUrl(stored);
    const path = signed.split('?')[0];
    expect(path).toContain('/raw/');
    expect(path).toMatch(/receipt_abc\.pdf$/);
    expect(signed).toContain('s--');
  });

  it('keeps image format in the delivery path', () => {
    const stored = 'https://res.cloudinary.com/demo/image/upload/v1234567890/omnedu/photos/logo.png';
    const signed = service.generateSignedDownloadUrl(stored);
    const path = signed.split('?')[0];
    expect(path).toContain('/image/');
    expect(path).toMatch(/logo\.png$/);
  });

  it('returns the original URL when it is not a Cloudinary delivery URL', () => {
    const stored = 'https://example.com/files/receipt.pdf';
    expect(service.generateSignedDownloadUrl(stored)).toBe(stored);
  });
});
