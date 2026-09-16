import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { env } from '../config/env';
import { ApiError } from '../utils/api-error';
import { DEFAULT_UPLOAD_ALLOWED_MIME, MAX_FILES_PER_UPLOAD } from '../utils/upload-path';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: env.uploadMaxBytes,
    files: MAX_FILES_PER_UPLOAD
  },
  fileFilter: (_req, file, callback) => {
    const allowed = env.uploadAllowedMime.length > 0 ? env.uploadAllowedMime : DEFAULT_UPLOAD_ALLOWED_MIME;
    if (!allowed.includes(file.mimetype)) {
      callback(new ApiError(400, 'UPLOAD_INVALID_TYPE', 'Only jpeg, png, and webp images are allowed.'));
      return;
    }

    callback(null, true);
  }
});

export const uploadFilesMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  upload.array('files', MAX_FILES_PER_UPLOAD)(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof ApiError) {
      next(error);
      return;
    }

    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code?: string }).code;
      if (code === 'LIMIT_FILE_SIZE') {
        next(new ApiError(413, 'UPLOAD_FILE_TOO_LARGE', 'File exceeds the maximum allowed size.'));
        return;
      }

      if (code === 'LIMIT_FILE_COUNT' || code === 'LIMIT_UNEXPECTED_FILE') {
        next(new ApiError(400, 'UPLOAD_TOO_MANY_FILES', 'Too many files in the upload request.'));
        return;
      }
    }

    next(new ApiError(400, 'UPLOAD_FAILED', 'File upload failed.'));
  });
};
