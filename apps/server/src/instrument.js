/**
 * @file apps/server/src/instrument.js
 * Source code module for HostelMate instrument.js.
 */

// Sentry placeholder - configure when DSN is available
export const sentryEnabled = false;
export const Sentry = {
  setupExpressErrorHandler: () => {},
};

export default function initSentry() {
  // Add Sentry init here when SENTRY_DSN is set
}
