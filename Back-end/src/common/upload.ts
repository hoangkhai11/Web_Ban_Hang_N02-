import { resolve } from 'node:path';

/** Dung lượng tối đa mỗi ảnh tải lên */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Thư mục lưu ảnh tải lên; ảnh được phục vụ tại /api/uploads/<tên file> */
export const uploadDir = () => resolve(process.env.UPLOAD_DIR ?? 'uploads');

/** Xác định loại ảnh theo nội dung file (không tin đuôi file hay Content-Type do client gửi). */
export function imageExtension(data: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
