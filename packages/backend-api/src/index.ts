import * as dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'fs';
import path from 'path';

import { ErrorCode, HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { MaintenanceResponse } from '@shared/api/endpoints/endpoint.models';

import { sendErrorResponse } from '@app/http';
import { junkToGuaranteeRouter } from '@app/routes/junkToGuarantee';

// Load root .env file — path differs between dev (src/) and prod (dist/backend-api/src/)
dotenv.config({ path: [
  path.resolve(__dirname, '../../../.env'),        // dev: packages/backend-api/src
  path.resolve(__dirname, '../../../../../.env'),  // prod: packages/backend-api/dist/backend-api/src
] });

const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json());
const port = process.env.PORT ?? 3001;

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

app.get('/', (_req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/junk-to-guarantee', junkToGuaranteeRouter);

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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
