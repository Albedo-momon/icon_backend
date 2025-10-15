import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { logger } from './config/logger';
import healthRoutes from './routes/health';
import cmsRoutes from './routes/cms';
import authRoutes from './routes/auth';
import meRoutes from './routes/me';
import homeRoutes from './routes/home';
import adminRoutes from './routes/admin';
import uploadsRouter from './routes/uploads';
import { formatError } from './utils/errors';

const app = express();

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

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming request');
  next();
});

// Routes
app.use('/', healthRoutes);
app.use('/', cmsRoutes);
app.use('/', authRoutes);
app.use('/', meRoutes);
app.use('/', homeRoutes);
app.use('/', adminRoutes);
app.use('/uploads', uploadsRouter);

// 404 handler (Express 5: avoid wildcard string)
app.use((req, res) => {
  logger.warn({ url: req.originalUrl }, 'Route not found');
  res.status(404).json(formatError('NOT_FOUND', 'Route not found'));
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json(formatError('INTERNAL_ERROR', 'Internal server error'));
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