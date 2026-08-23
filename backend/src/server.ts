import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { connectMongo } from './db/mongo.js';
import { buildOpenApiSpec } from './docs/openapi.js';
import { accountRouter } from './routes/accountRoutes.js';
import { algorandRouter } from './routes/algorandRoutes.js';
import { identityRouter } from './routes/identityRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';

const app = express();

// ── Production safety checks ─────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !env.accountsApiKey) {
  // Hard-fail in production: an unprotected account-mapping API is a privacy risk.
  console.error(
    '[FATAL] ACCOUNTS_API_KEY must be set in production. ' +
    'The x402 account-mapping endpoints will be publicly accessible without it. ' +
    'Set a strong secret in backend/.env and restart.'
  );
  process.exit(1);
}

if (!isProduction && !env.accountsApiKey) {
  console.warn(
    '[WARNING] ACCOUNTS_API_KEY is not set. ' +
    'Account-mapping endpoints are open (development mode). ' +
    'Set ACCOUNTS_API_KEY in backend/.env before deploying to production.'
  );
}

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCssUrl: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css',
  customJs: [
    'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js',
    'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js'
  ]
}));

app.get('/', (_request, response) => {
  response.json({ ok: true, service: 'ghostpay-backend', status: 'running' });
});

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'ghostpay-backend' });
});

app.use('/api/algorand', algorandRouter);
app.use('/api/identity', identityRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/notifications', notificationRouter);

// ── Swagger UI ────────────────────────────────────────────────────────────────
// Available at /api/docs in all environments.
// In production, consider protecting this route or disabling it entirely.
const openApiSpec = buildOpenApiSpec();
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'GhostPay API Docs',
    customCssUrl: 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css',
    customJs: [
      'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js',
      'https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js'
    ],
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list'
    }
  })
);

void connectMongo().catch((error: unknown) => {
  console.error('MongoDB connection failed:', error instanceof Error ? error.message : error);
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`GhostPay backend listening on http://localhost:${env.port}`);
  });
}

export default app;
