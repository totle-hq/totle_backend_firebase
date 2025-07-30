// src/utils/logger.js
// Logger utility - centralized and consistent logging across backend

const isProduction = process.env.NODE_ENV === 'production';

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  return JSON.stringify({
    level,
    message,
    ...(meta && { meta }),
    timestamp
  });
};

const logger = {
  info: (message, meta) => {
    if (!isProduction) console.info('[INFO]', formatMessage('info', message, meta));
  },
  warn: (message, meta) => {
    console.warn('[WARN]', formatMessage('warn', message, meta));
  },
  error: (message, meta) => {
    console.error('[ERROR]', formatMessage('error', message, meta));
  },
  debug: (message, meta) => {
    if (!isProduction) console.debug('[DEBUG]', formatMessage('debug', message, meta));
  },
};

export default logger;
