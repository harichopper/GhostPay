/**
 * requireApiKey.ts
 *
 * Service-to-service API key authentication middleware.
 *
 * Checks for an Authorization header of the form:
 *   Authorization: Bearer <api_key>
 * or an X-Api-Key header:
 *   X-Api-Key: <api_key>
 *
 * Controlled by the ACCOUNTS_API_KEY environment variable.
 * If ACCOUNTS_API_KEY is not set, the middleware is bypassed (open in dev).
 */

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export function requireApiKey(request: Request, response: Response, next: NextFunction): void {
  // If no API key is configured, allow all requests (dev / unconfigured environment).
  if (!env.accountsApiKey) {
    next();
    return;
  }

  const bearerHeader = request.headers['authorization'];
  const xApiKey = request.headers['x-api-key'];

  let provided: string | undefined;

  if (typeof bearerHeader === 'string' && bearerHeader.startsWith('Bearer ')) {
    provided = bearerHeader.slice('Bearer '.length).trim();
  } else if (typeof xApiKey === 'string') {
    provided = xApiKey.trim();
  }

  if (!provided || provided !== env.accountsApiKey) {
    response.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'A valid API key is required. Provide it via Authorization: Bearer <key> or X-Api-Key header.'
    });
    return;
  }

  next();
}
