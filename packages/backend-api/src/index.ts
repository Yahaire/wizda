import * as dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'fs';
import path from 'path';

import { ErrorCode, HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { MaintenanceResponse, RequestErrorInfo } from '@shared/api/endpoints/endpoint.models';

// Load root .env file — path differs between dev (src/) and prod (dist/backend-api/src/)
dotenv.config({ path: [
  path.resolve(__dirname, '../../../.env'),        // dev: packages/backend-api/src
  path.resolve(__dirname, '../../../../../.env'),  // prod: packages/backend-api/dist/backend-api/src
] });

const app = express();
app.set('trust proxy', 'loopback');
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

// TODO: wire up Prisma once the schema has models and the client is generated
// (`npx prisma generate`). See packages/backend-api/prisma/seed-from-html for
// the same setup pattern.
//
//   import { PrismaClient } from '@local-prisma/generated/client';
//   import { PrismaPg } from '@prisma/adapter-pg';
//   import { Pool } from 'pg';
//
//   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
//   const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function sendErrorResponse(
  res: express.Response,
  statusCode: HttpStatusCode,
  errorCode: string,
  message: string,
) {
  const errorInfo: RequestErrorInfo = {
    errorCode,
    message,
  };
  res.status(statusCode).json(errorInfo);
}

app.get('/', (_req, res) => {
  res.json({ message: 'API is running' });
});

// Placeholder for the core endpoint: given a target item, return how much junk
// must be farmed to guarantee it. Implement once the data layer exists.
app.get('/junk-to-guarantee/:itemId', (req, res) => {
  sendErrorResponse(
    res,
    HttpStatusCode.NOT_FOUND,
    ErrorCode.INVALID_QUERY,
    `Not implemented yet (item: ${req.params.itemId}).`,
  );
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
