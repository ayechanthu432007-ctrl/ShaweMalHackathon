import { Request, Response } from 'express';

import { saveUploadedFiles } from '../services/upload.service';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { isUploadCategory, maxFilesForCategory } from '../utils/upload-path';

export const uploadFilesController = async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Authorization context is missing.');
  }

  const categoryRaw = typeof req.query.category === 'string' ? req.query.category : req.body?.category;
  if (!isUploadCategory(categoryRaw)) {
    throw new ApiError(400, 'UPLOAD_INVALID_CATEGORY', 'category must be one of: houses, moving, docs, profile, marketplace.');
  }

  const files = (req.files ?? []) as Express.Multer.File[];
  if (files.length === 0) {
    throw new ApiError(400, 'UPLOAD_NO_FILES', 'No file provided.');
  }

  const maxFiles = maxFilesForCategory(categoryRaw);
  if (files.length > maxFiles) {
    throw new ApiError(400, 'UPLOAD_TOO_MANY_FILES', `At most ${maxFiles} file(s) allowed for category ${categoryRaw}.`);
  }

  try {
    const paths = await saveUploadedFiles({ category: categoryRaw, files });
    sendSuccess(res, 201, 'Files uploaded successfully', { paths });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UPLOAD_FAILED';
    if (code === 'NO_FILES') {
      throw new ApiError(400, 'UPLOAD_NO_FILES', 'No file provided.');
    }
    if (code === 'TOO_MANY_FILES') {
      throw new ApiError(400, 'UPLOAD_TOO_MANY_FILES', `At most ${maxFiles} file(s) allowed for category ${categoryRaw}.`);
    }
    if (code === 'INVALID_TYPE') {
      throw new ApiError(400, 'UPLOAD_INVALID_TYPE', 'Only jpeg, png, and webp images are allowed.');
    }
    if (code === 'EMPTY_FILE') {
      throw new ApiError(400, 'UPLOAD_EMPTY_FILE', 'Empty files are not allowed.');
    }
    if (code === 'FILE_TOO_LARGE') {
      throw new ApiError(413, 'UPLOAD_FILE_TOO_LARGE', 'File exceeds the maximum allowed size.');
    }

    throw new ApiError(500, 'UPLOAD_FAILED', 'File upload failed.');
  }
};
