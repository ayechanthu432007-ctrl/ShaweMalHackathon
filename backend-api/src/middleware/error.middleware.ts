import { NextFunction, Request, Response } from 'express';

import { ApiError } from '../utils/api-error';
import { sendError } from '../utils/api-response';

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.message, err.details ? { code: err.code, details: err.details } : { code: err.code });
    return;
  }

  // Request-body problems (too large, malformed JSON) are the client's mistake, not a server error.
  const bodyError = err as { type?: string; status?: number };
  if (bodyError?.type === 'entity.too.large') {
    sendError(res, 413, 'Request body is too large.', { code: 'REQUEST_TOO_LARGE' });
    return;
  }
  if (bodyError?.type === 'entity.parse.failed' || bodyError?.type === 'encoding.unsupported' || bodyError?.type === 'charset.unsupported') {
    sendError(res, 400, 'Request body could not be read.', { code: 'REQUEST_BODY_INVALID' });
    return;
  }

  const error = err as Error;
  const exposeMessage = process.env.NODE_ENV !== 'production';

  console.error('Unhandled API error', {
    message: error.message,
    name: error.name,
    stack: error.stack
  });

  sendError(res, 500, 'Internal server error', {
    code: 'INTERNAL_SERVER_ERROR',
    details: exposeMessage ? error.message : undefined
  });
};
