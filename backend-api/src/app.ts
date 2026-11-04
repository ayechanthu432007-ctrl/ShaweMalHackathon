import cors from 'cors';
import express from 'express';

import { createCorsOriginOption } from './config/cors-origin';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';
import { notFoundMiddleware } from './middleware/not-found.middleware';
import { remotePublicUploadsMiddleware } from './middleware/remote-public-uploads.middleware';
import { limits } from './middleware/rate-limit.middleware';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { configureProxyTrust, maybeCompression, securityHeaders, warnAboutOpenCors } from './middleware/security.middleware';
import { apiRouter } from './routes';
import { getStorage } from './storage';
import { ensureUploadDirectories } from './services/upload.service';

export const app = express();

void ensureUploadDirectories().catch((error: unknown) => {
  console.error('Failed to initialize upload storage', error);
});

configureProxyTrust(app);
warnAboutOpenCors();
app.use(securityHeaders());
const compressionMiddleware = maybeCompression();
if (compressionMiddleware) app.use(compressionMiddleware);
app.use(requestIdMiddleware);
app.use(
  cors({
    origin: createCorsOriginOption(env.corsOrigin),
    credentials: true
  })
);
// Explicit body limits: JSON endpoints never need more, and uploads use multipart with their own caps.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb', parameterLimit: 200 }));

const storage = getStorage();
if (storage.servesLocalStatic) {
  app.use('/uploads', (req, res, next) => {
    const normalized = req.path.replace(/\\/g, '/');
    if (normalized === '/docs' || normalized.startsWith('/docs/')) {
      res.status(404).end();
      return;
    }

    next();
  }, express.static(env.uploadRoot));
} else {
  app.use('/uploads', (req, res, next) => {
    void remotePublicUploadsMiddleware(req, res, next);
  });
}

app.use('/api', limits.global, apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
