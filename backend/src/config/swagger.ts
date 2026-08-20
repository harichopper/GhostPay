import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env.js';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GhostPay API',
      version: '1.0.0',
      description: 'API documentation for GhostPay - an offline-first Algorand payment backend with a mobile-number identity layer.',
    },
    servers: [
      {
        url: `http://localhost:${env.port}`,
        description: 'Local Development Server',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js', './routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
