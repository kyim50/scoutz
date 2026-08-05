import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import sharp from 'sharp';
import logger from '../utils/logger';
import { badRequest, isAppError } from '../utils/errors';

const BUCKET_NAME = 'images';

/** Formats we are willing to decode, determined from file bytes not headers. */
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'gif', 'avif']);

/** ~50MP. Guards against decompression bombs. */
const MAX_PIXELS = 50_000_000;

export class UploadService {
  /**
   * Upload image to Supabase Storage
   */
  async uploadImage(file: Express.Multer.File): Promise<{ url: string; thumbnailUrl: string }> {
    try {
      const fileId = randomUUID();

      // Decode the header before doing any work. multer's fileFilter only sees
      // the client-supplied mimetype, which is trivially forged — this reads
      // the actual bytes and is what decides whether the file is an image.
      const metadata = await sharp(file.buffer)
        .metadata()
        .catch(() => null);

      if (!metadata?.format || !ALLOWED_FORMATS.has(metadata.format)) {
        throw badRequest('That file is not a supported image (JPEG, PNG, WebP, HEIF, or GIF)');
      }

      // Reject decompression bombs: a small file can declare enormous
      // dimensions and exhaust memory when sharp materialises the bitmap.
      const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
      if (pixels > MAX_PIXELS) {
        throw badRequest('That image is too large. Maximum 50 megapixels.');
      }

      // Resize main image (max 1200px)
      const resizedImage = await sharp(file.buffer)
        .rotate() // honour EXIF orientation before stripping it
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Create thumbnail (300px)
      const thumbnail = await sharp(file.buffer)
        .rotate()
        .resize(300, 300, {
          fit: 'cover',
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const mainPath = `images/${fileId}.jpg`;
      const thumbPath = `images/${fileId}_thumb.jpg`;

      const { error: mainError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(mainPath, resizedImage, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (mainError) {
        logger.error('Supabase main upload error:', mainError);
        throw new Error('Failed to upload image');
      }

      const { error: thumbError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(thumbPath, thumbnail, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (thumbError) {
        logger.error('Supabase thumbnail upload error:', thumbError);
        throw new Error('Failed to upload thumbnail');
      }

      const {
        data: { publicUrl: url },
      } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(mainPath);
      const {
        data: { publicUrl: thumbnailUrl },
      } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(thumbPath);

      logger.info('Image uploaded to Supabase:', { fileId, url });

      return { url, thumbnailUrl };
    } catch (error) {
      // Preserve validation failures so the user is told what was wrong with
      // their file rather than getting a generic 500.
      if (isAppError(error)) throw error;
      logger.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }

  /**
   * Delete image from Supabase Storage
   */
  async deleteImage(url: string): Promise<void> {
    try {
      // Extract path from URL: .../object/public/images/path or .../public/images/path
      const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
      if (!match) {
        throw new Error('Invalid image URL');
      }
      const path = match[1];

      const { error } = await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);

      if (error) {
        logger.error('Supabase delete error:', error);
        throw new Error('Failed to delete image');
      }

      // Try to delete thumbnail if it exists
      const thumbPath = path.replace('.jpg', '_thumb.jpg');
      if (thumbPath !== path) {
        await supabaseAdmin.storage.from(BUCKET_NAME).remove([thumbPath]);
      }

      logger.info('Image deleted:', { path });
    } catch (error) {
      logger.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  }
}

export default new UploadService();
