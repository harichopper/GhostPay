import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env.js';

function buildServers() {
  const servers: Array<{ url: string; description: string }> = [];

  if (process.env.API_BASE_URL) {
    servers.push({ url: process.env.API_BASE_URL, description: 'Production' });
  }
  if (process.env.VERCEL_URL) {
    servers.push({ url: `https://${process.env.VERCEL_URL}`, description: 'Vercel deployment' });
  }
  servers.push({ url: `http://localhost:${env.port}`, description: 'Local development' });

  return servers;
}

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GhostPay API',
      version: '1.0.0',
      description: 'API documentation for GhostPay — offline-first Algorand payment wallet with x402 payment protocol.',
    },
    servers: buildServers(),
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js', './routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
