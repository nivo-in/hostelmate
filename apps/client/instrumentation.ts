// Server/edge-side Sentry init for the Next.js runtime.
import * as Sentry from '@sentry/nextjs';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://f122f632a879eed019b0b1c7f112c363@o4511620377083904.ingest.de.sentry.io/4511620380491856',
      tracesSampleRate: 1.0,
      enabled: process.env.NODE_ENV === 'production',
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || 'https://f122f632a879eed019b0b1c7f112c363@o4511620377083904.ingest.de.sentry.io/4511620380491856',
      tracesSampleRate: 1.0,
      enabled: process.env.NODE_ENV === 'production',
    });
  }
}
