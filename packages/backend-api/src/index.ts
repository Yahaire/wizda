import * as dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'fs';
import path from 'path';

import { ErrorCode, HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { MaintenanceResponse } from '@shared/api/endpoints/endpoint.models';
import { BUILD_TIME, GIT_COMMIT, VERSION_LABEL } from '@shared/generated/version';

import { sendErrorResponse } from '@app/http';
import { dataStatusRouter, readDataUpdatedAt } from '@app/routes/dataStatus';
import { junkToGuaranteeRouter } from '@app/routes/junkToGuarantee';
import { listsRouter } from '@app/routes/lists';

// Load root .env file — path differs between dev (src/) and prod (dist/backend-api/src/)
dotenv.config({ path: [
  path.resolve(__dirname, '../../../.env'),        // dev: packages/backend-api/src
  path.resolve(__dirname, '../../../../../.env'),  // prod: packages/backend-api/dist/backend-api/src
] });

const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json());
const port = process.env.PORT ?? 3001;
// Bind loopback-only by default. In production the API is reached solely through
// Apache's reverse proxy over localhost — never directly from the internet (see
// DEPLOY.md "Security: network exposure"). Overridable via HOST if ever needed.
const host = process.env.HOST ?? '127.0.0.1';

const maintenanceFlagPaths = [
  path.resolve(__dirname, '../../../.maintenance'),       // dev:  packages/backend-api/src
  path.resolve(__dirname, '../../../../../.maintenance'), // prod: packages/backend-api/dist/backend-api/src
];
const isMaintenanceMode = (): boolean => maintenanceFlagPaths.some(existsSync);

app.use((_req, res, next) => {
  if (isMaintenanceMode()) {
    const body: MaintenanceResponse = {
      maintenance: true,
      message: 'Updating data, back soon.',
    };
    res.status(503).json(body);
    return;
  }
  next();
});

app.get('/', (_req, res, next) => {
  // Keep the root a lightweight liveness signal: if the data-status read fails
  // (e.g. DB down), still report the app is up with a null timestamp rather than
  // erroring. The dedicated /data-status endpoint surfaces such failures.
  readDataUpdatedAt()
    .catch(() => null)
    .then((dataUpdatedAt) => {
      res.json({
        message: 'API is running',
        commit: GIT_COMMIT,
        buildTime: BUILD_TIME,
        dataUpdatedAt,
      });
    })
    .catch(next);
});

app.use('/junk-to-guarantee', junkToGuaranteeRouter);
app.use(dataStatusRouter);
app.use(listsRouter);

// Catch-all error handler for anything thrown/rejected in a route.
app.use((
  err: unknown,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  console.error('[api] unhandled error:', err);
  sendErrorResponse(
    res,
    HttpStatusCode.INTERNAL_SERVER_ERROR,
    ErrorCode.INTERNAL_ERROR,
    'Something went wrong.',
  );
});

app.listen(Number(port), host, () => {
  console.log(`Server listening at http://${host}:${port} — ${VERSION_LABEL}`);
});
