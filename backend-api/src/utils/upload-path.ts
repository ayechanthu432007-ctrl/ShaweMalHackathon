export const UPLOAD_CATEGORIES = ['houses', 'moving', 'docs', 'profile', 'marketplace'] as const;

export type UploadCategory = (typeof UPLOAD_CATEGORIES)[number];

export const PUBLIC_UPLOAD_CATEGORIES: UploadCategory[] = ['houses', 'moving', 'profile', 'marketplace'];

export const UPLOADED_PATH_REGEX = /^uploads\/(houses|moving|docs|profile|marketplace)\/[a-zA-Z0-9._-]+$/;

export const UPLOAD_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

export const DEFAULT_UPLOAD_ALLOWED_MIME = Object.keys(UPLOAD_MIME_TO_EXTENSION);

export const MARKETPLACE_MAX_PHOTOS = 10;

/** Largest per-request file count across all categories (multer limit). */
export const MAX_FILES_PER_UPLOAD = MARKETPLACE_MAX_PHOTOS;

export const maxFilesForCategory = (category: UploadCategory): number => {
  if (category === 'marketplace') {
    return MARKETPLACE_MAX_PHOTOS;
  }

  return category === 'houses' || category === 'moving' ? 5 : 1;
};

export const isUploadCategory = (value: unknown): value is UploadCategory => {
  return typeof value === 'string' && (UPLOAD_CATEGORIES as readonly string[]).includes(value);
};

export const isValidUploadedPath = (value: string, category?: UploadCategory): boolean => {
  if (!UPLOADED_PATH_REGEX.test(value)) {
    return false;
  }

  if (category && !value.startsWith(`uploads/${category}/`)) {
    return false;
  }

  return true;
};

export const uploadedPathMessage = (category?: UploadCategory): string => {
  if (category) {
    return `Must be a server upload path under uploads/${category}/.`;
  }

  return 'Must be a server upload path under uploads/{houses|moving|docs|profile|marketplace}/.';
};
