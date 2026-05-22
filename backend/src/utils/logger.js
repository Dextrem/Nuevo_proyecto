const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  http: '\x1b[35m',
  debug: '\x1b[34m',
};

const reset = '\x1b[0m';

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const color = colors[level] || '';
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  
  return `${color}[${level.toUpperCase()}]${reset} ${timestamp} | ${message} ${metaStr}`;
};

export const logger = {
  error: (message, meta = {}) => {
    console.error(formatMessage('error', message, meta));
  },
  
  warn: (message, meta = {}) => {
    console.warn(formatMessage('warn', message, meta));
  },
  
  info: (message, meta = {}) => {
    console.log(formatMessage('info', message, meta));
  },
  
  http: (message, meta = {}) => {
    console.log(formatMessage('http', message, meta));
  },
  
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  
  next();
};