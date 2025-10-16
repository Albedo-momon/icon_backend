import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

const opts: any = { level };
if (!isProd) {
  opts.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      singleLine: true,
    },
  };
}

export const logger = pino(opts);