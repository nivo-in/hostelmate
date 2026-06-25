// Browser-side Sentry init (Next auto-loads this file in the client bundle).
import * as Sentry from '@sentry/nextjs';

const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  'https://f122f632a879eed019b0b1c7f112c363@o4511620377083904.ingest.de.sentry.io/4511620380491856';

Sentry.init({
  dsn: DSN,
  tracesSampleRate: 0.1,
  // Only report from production builds to avoid local-dev noise.
  enabled: process.env.NODE_ENV === 'production',
});
