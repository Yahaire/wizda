import express from 'express';

import { HttpStatusCode } from '@shared/api/endpoints/endpoint.constants';
import { RequestErrorInfo } from '@shared/api/endpoints/endpoint.models';

/** Send a typed error body with the given status code. */
export function sendErrorResponse(
  res: express.Response,
  statusCode: HttpStatusCode,
  errorCode: string,
  message: string,
): void {
  const body: RequestErrorInfo = {
    errorCode,
    message,
  };
  res.status(statusCode).json(body);
}
