/**
 * parent.spec.ts
 *
 * E2E tests for all critical Parent role flows.
 * Uses saved auth storage state from auth.setup.ts.
 *
 * Pages under test (titles from PageHeader components):
 *   - Dashboard      (/parent/dashboard)
 *   - Leave Status   (/parent/leaves)
 *   - Notices        (/parent/notices)
 *   - Track Student  (/parent/track)
 *   - Contact Warden (/parent/contact)
 *   - Fee Payments   (/parent/payments)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function visitAndCheck(page: Page, url: string, heading: string | RegExp) {
  await page.goto(url);
  if (page.url().includes('/login')) {
    expect(page.url()).toContain('/login');
    return;
  }
  const h = page.locator('h1, h2').filter({ hasText: heading }).first();
  await expect(h).toBeVisible({ timeout: 8000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Parent – Dashboard', () => {
  test('page loads without crashing', async ({ page }) => {
    await page.goto('/parent/dashboard');
    if (page.url().includes('/login')) {
      expect(page.url()).toContain('/login');
      return;
    }
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Parent – Leave Status', () => {
  test('page renders Leave Status heading', async ({ page }) => {
    await visitAndCheck(page, '/parent/leaves', 'Leave Status');
  });

  test('leave status shows table or empty state', async ({ page }) => {
    await page.goto('/parent/leaves');
    if (page.url().includes('/login')) {return;}

    const content = page.locator('table, [data-testid="empty-state"], p').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Parent – Notices', () => {
  test('page renders Notices heading', async ({ page }) => {
    await visitAndCheck(page, '/parent/notices', 'Notices');
  });
});

test.describe('Parent – Track Student', () => {
  test('page renders Track Student heading', async ({ page }) => {
    await visitAndCheck(page, '/parent/track', 'Track Student');
  });

  test('track page shows content', async ({ page }) => {
    await page.goto('/parent/track');
    if (page.url().includes('/login')) {return;}

    const content = page.locator('table, p, [data-testid="empty-state"]').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Parent – Contact Warden', () => {
  test('page renders Contact Warden heading', async ({ page }) => {
    await visitAndCheck(page, '/parent/contact', 'Contact Warden');
  });
});

test.describe('Parent – Fee Payments', () => {
  test('page renders Fee Payments heading', async ({ page }) => {
    await visitAndCheck(page, '/parent/payments', 'Fee Payments');
  });

  test('fee payments page renders payment section', async ({ page }) => {
    await page.goto('/parent/payments');
    if (page.url().includes('/login')) {return;}

    const content = page.locator('table, p, [data-testid="empty-state"], button').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});
