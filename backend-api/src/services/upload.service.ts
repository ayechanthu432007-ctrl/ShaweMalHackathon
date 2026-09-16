import { randomUUID } from 'node:crypto';
import path from 'node:path';

import sharp from 'sharp';

import { env } from '../config/env';
import { diskObjectAbsolutePath } from '../storage/disk.storage';
import { getStorage } from '../storage';
import {
  maxFilesForCategory,
  PUBLIC_UPLOAD_CATEGORIES,
  UPLOAD_MIME_TO_EXTENSION,
  type UploadCategory
} from '../utils/upload-path';

export const getUploadRoot = (): string => env.uploadRoot;

export const getCategoryDirectory = (category: UploadCategory): string => {
  return path.join(getUploadRoot(), category);
};

export const ensureUploadDirectories = async (): Promise<void> => {
  await getStorage().ensureReady();
};

export const toStoredRelativePath = (category: UploadCategory, filename: string): string => {
  return `uploads/${category}/${filename}`;
};

export const toAbsoluteUploadPath = (relativePath: string): string => {
  return diskObjectAbsolutePath(relativePath);
};

export const isPublicUploadRelativePath = (relativePath: string): boolean => {
  return PUBLIC_UPLOAD_CATEGORIES.some((category) => relativePath.startsWith(`uploads/${category}/`));
};

type SaveUploadedFilesInput = {
  category: UploadCategory;
  files: Express.Multer.File[];
};

export const saveUploadedFiles = async (input: SaveUploadedFilesInput): Promise<string[]> => {
  const maxFiles = maxFilesForCategory(input.category);
  if (input.files.length === 0) {
    throw new Error('NO_FILES');
  }

  if (input.files.length > maxFiles) {
    throw new Error('TOO_MANY_FILES');
  }

  const storage = getStorage();
  await storage.ensureReady();
  const paths: string[] = [];

  for (const file of input.files) {
    const extension = UPLOAD_MIME_TO_EXTENSION[file.mimetype];
    if (!extension) {
      throw new Error('INVALID_TYPE');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new Error('EMPTY_FILE');
    }

    if (file.size > env.uploadMaxBytes) {
      throw new Error('FILE_TOO_LARGE');
    }

    const baseName = randomUUID();
    const objectKey = toStoredRelativePath(input.category, `${baseName}${extension}`);

    // Marketplace photos also get an optimized copy and a thumbnail. Decoding with sharp
    // doubles as a content check: files that only claim to be images are rejected.
    const variants = input.category === 'marketplace' ? await buildMarketplaceVariants(file.buffer) : null;

    const stored = await storage.putObject({
      category: input.category,
      objectKey,
      buffer: file.buffer,
      contentType: file.mimetype
    });

    if (variants) {
      const variantKeys = marketplaceVariantPaths(stored.storedPath);
      await storage.putObject({
        category: input.category,
        objectKey: variantKeys.optimizedPath,
        buffer: variants.optimized,
        contentType: 'image/webp'
      });
      await storage.putObject({
        category: input.category,
        objectKey: variantKeys.thumbnailPath,
        buffer: variants.thumbnail,
        contentType: 'image/webp'
      });
    }

    paths.push(stored.storedPath);
  }

  return paths;
};

const MARKETPLACE_MAX_INPUT_PIXELS = 50_000_000;
const MARKETPLACE_OPTIMIZED_MAX_EDGE = 1600;
const MARKETPLACE_THUMBNAIL_MAX_EDGE = 400;

/** Derives the optimized/thumbnail object keys stored next to a marketplace original. */
export const marketplaceVariantPaths = (originalPath: string) => {
  const withoutExtension = originalPath.replace(/\.[a-zA-Z0-9]+$/, '');
  return {
    optimizedPath: `${withoutExtension}_lg.webp`,
    thumbnailPath: `${withoutExtension}_th.webp`
  };
};

const buildMarketplaceVariants = async (buffer: Buffer) => {
  try {
    const source = sharp(buffer, { limitInputPixels: MARKETPLACE_MAX_INPUT_PIXELS }).rotate();
    const [optimized, thumbnail] = await Promise.all([
      source
        .clone()
        .resize({ width: MARKETPLACE_OPTIMIZED_MAX_EDGE, height: MARKETPLACE_OPTIMIZED_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer(),
      source
        .clone()
        .resize({ width: MARKETPLACE_THUMBNAIL_MAX_EDGE, height: MARKETPLACE_THUMBNAIL_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer()
    ]);

    return { optimized, thumbnail };
  } catch {
    throw new Error('INVALID_TYPE');
  }
};

export const readStoredObject = async (
  objectKey: string
): Promise<{ buffer: Buffer; contentType: string }> => {
  return getStorage().getObject(objectKey);
};
