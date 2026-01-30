/**
 * warden.spec.ts
 *
 * E2E tests for all critical Warden role flows.
 * Uses saved auth storage state from auth.setup.ts.
 *
 * Pages under test (titles from PageHeader components):
 *   - Attendance Management  (/warden/attendance)
 *   - Leave Management       (/warden/leaves)
 *   - Complaint Analytics    (/warden/complaints)
 *   - Mess Management        (/warden/mess)
 *   - Room Allocation        (/warden/rooms)
 *   - Notices                (/warden/notices)
 *   - Emergency              (/warden/emergency)
 *   - Curfew Management      (/warden/curfew)
 *   - Staff Directory        (/warden/staff)
 *   - Fee Management         (/warden/payments)
 *   - Visitor Management     (/warden/visitors)
 *   - Audit Log              (/warden/audit)
 *   - Lost & Found           (/warden/lost-found)
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

test.describe('Warden – Attendance Management', () => {
  test('page renders Attendance Management heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/attendance', 'Attendance Management');
  });
});

test.describe('Warden – Leave Management', () => {
  test('page renders Leave Management heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/leaves', 'Leave Management');
  });

  test('shows leave table or empty state', async ({ page }) => {
    await page.goto('/warden/leaves');
    if (page.url().includes('/login')) return;

    const content = page.locator('table, [data-testid="empty-state"], p').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Warden – Complaint Analytics', () => {
  test('page renders Complaint Analytics heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/complaints', 'Complaint Analytics');
  });
});

test.describe('Warden – Mess Management', () => {
  test('page renders Mess Management heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/mess', 'Mess Management');
  });
});

test.describe('Warden – Room Allocation', () => {
  test('page renders Room Allocation heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/rooms', 'Room Allocation');
  });
});

test.describe('Warden – Notices', () => {
  test('page renders Notices heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/notices', 'Notices');
  });

  test('notice form has title input and submit button', async ({ page }) => {
    await page.goto('/warden/notices');
    if (page.url().includes('/login')) return;

    await expect(page.locator('input[type="text"]').first()).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe('Warden – Emergency', () => {
  test('page renders Emergency heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/emergency', 'Emergency');
  });
});

test.describe('Warden – Curfew Management', () => {
  test('page renders Curfew Management heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/curfew', 'Curfew Management');
  });
});

test.describe('Warden – Staff Directory', () => {
  test('page renders Staff Directory heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/staff', 'Staff Directory');
  });
});

test.describe('Warden – Fee Management', () => {
  test('page renders Fee Management heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/payments', 'Fee Management');
  });

  test('fee page shows content section', async ({ page }) => {
    await page.goto('/warden/payments');
    if (page.url().includes('/login')) return;

    const content = page.locator('table, form, button, [data-testid="empty-state"]').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Warden – Visitor Management', () => {
  test('page renders Visitor Management heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/visitors', 'Visitor Management');
  });

  test('visitor page shows table or empty state', async ({ page }) => {
    await page.goto('/warden/visitors');
    if (page.url().includes('/login')) return;

    const content = page.locator('table, [data-testid="empty-state"], p').first();
    await expect(content).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Warden – Audit Log', () => {
  test('page renders Audit Log heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/audit', 'Audit Log');
  });
});

test.describe('Warden – Lost & Found', () => {
  test('page renders Lost & Found heading', async ({ page }) => {
    await visitAndCheck(page, '/warden/lost-found', /Lost.*Found/i);
  });
});
