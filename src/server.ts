import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { env } from './config/env';
import { logger } from './config/logger';
import pinoHttp from 'pino-http';
import healthRoutes from './routes/health';
import cmsRoutes from './routes/cms';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import homeRoutes from './routes/home';
import adminRoutes from './routes/admin';
import uploadsRouter from './routes/uploads';
import debugRoutes from './routes/debug';
import adminRouter from './routes/admin/index';
import publicRouter from './routes/public';
import { requireAdmin } from './middleware/requireAdmin';
import { requireAuth } from './middleware/requireAuth';
import { formatError } from './utils/errors';
import listEndpoints from 'express-list-endpoints';

const app = express();

// Structured request logging (first middleware)
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (err) return 'error';
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(','),
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/', healthRoutes);
app.use('/', cmsRoutes);
app.use('/', authRoutes);
app.use('/', meRoutes);
app.use('/', homeRoutes);
app.use('/', adminRoutes);
app.use('/uploads', uploadsRouter);
app.use('/', debugRoutes);

// Requested mounts
app.use('/admin', requireAuth, requireAdmin, adminRouter);
app.use('/', publicRouter);
logger.info('Mounted routers: /admin (protected), / (public)');

// Print route list (dev aid)
try {
  const endpoints = (listEndpoints as any)(app);
  logger.info({ endpoints }, 'ROUTES registered');
} catch (e) {
  logger.warn({ error: (e as Error).message }, 'Failed to list endpoints');
}

// Debug: list routes via internal router stack (Express 5 may not support external libs)
app.get('/__debug/routes', (_req, res) => {
  const routes: any[] = [];
  const stack = (app as any)._router?.stack || [];
  stack.forEach((layer: any) => {
    if (layer.route) {
      const path = layer.route.path;
      const methods = Object.keys(layer.route.methods || {}).filter((m) => (layer.route.methods as any)[m]);
      routes.push({ path, methods });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      layer.handle.stack.forEach((h: any) => {
        const route = h.route;
        if (route) {
          const path = route.path;
          const methods = Object.keys(route.methods || {}).filter((m) => (route.methods as any)[m]);
          routes.push({ path, methods });
        }
      });
    }
  });
  res.json({ routes });
});

// 404 handler (Express 5: avoid wildcard string)
app.use((req, res) => {
  logger.warn({ url: req.originalUrl }, 'Route not found');
  res.status(404).json(formatError('NOT_FOUND', 'Route not found'));
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  (req as any).log?.error({ err });
  logger.error({ error: err?.message, stack: err?.stack }, 'Unhandled error');
  res.status(500).json(formatError('INTERNAL_ERROR', 'Something went wrong'));
});

// Start server
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started successfully');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;