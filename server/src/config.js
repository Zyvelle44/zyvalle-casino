const PLACEHOLDER_SECRET_PATTERNS = [
  /^change(me)?/i,
  /^replace/i,
  /^your[-_ ]/i,
  /^example/i,
  /^placeholder/i,
  /^secret$/i,
];

function isPlaceholder(value) {
  return PLACEHOLDER_SECRET_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function requireStrongSecret(name, value) {
  if (typeof value !== 'string' || value.length < 32 || isPlaceholder(value)) {
    throw new Error(
      `${name} must be a unique random value with at least 32 characters. Generate one before starting the API.`,
    );
  }
}

function parseOrigin(name, value, { production = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid origin URL, for example http://localhost:5173.`);
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.replace(/\/$/, '')) {
    throw new Error(`${name} must contain only the scheme, host, and optional port; do not include a path.`);
  }
  if (production && (url.protocol !== 'https:' || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url.host))) {
    throw new Error(`${name} must be a public HTTPS origin in production.`);
  }
  return url.origin;
}

export function assertRuntimeConfig() {
  const env = process.env.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(env)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  requireStrongSecret('SESSION_SECRET', process.env.SESSION_SECRET);

  const port = Number(process.env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  parseOrigin('CLIENT_ORIGIN', process.env.CLIENT_ORIGIN || 'http://localhost:5173', {
    production: env === 'production',
  });

  if (env === 'production') {
    if (!process.env.DATABASE_PASSWORD) {
      throw new Error('DATABASE_PASSWORD must be configured in production.');
    }
    if (!process.env.DATABASE_USER || process.env.DATABASE_USER.toLowerCase() === 'root') {
      throw new Error('Use a dedicated least-privilege database user in production; do not use root.');
    }
    if (!process.env.DATABASE_NAME || !process.env.DATABASE_HOST) {
      throw new Error('DATABASE_HOST and DATABASE_NAME must be configured in production.');
    }
  }
}
