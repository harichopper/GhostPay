import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { connectMongo } from './db/mongo.js';
import { algorandRouter } from './routes/algorandRoutes.js';
import { identityRouter } from './routes/identityRoutes.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'ghostpay-backend' });
});

app.use('/api/algorand', algorandRouter);
app.use('/api/identity', identityRouter);

void connectMongo().catch((error: unknown) => {
  console.error('MongoDB connection failed:', error instanceof Error ? error.message : error);
});

app.listen(env.port, () => {
  console.log(`GhostPay backend listening on http://localhost:${env.port}`);
});
