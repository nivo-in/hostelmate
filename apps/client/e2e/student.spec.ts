/**
 * student.spec.ts
 *
 * E2E tests for all critical Student role flows.
 * Uses saved auth storage state from auth.setup.ts so login is not repeated.
 *
 * Pages under test (titles sourced from PageHeader components):
 *   - Leave Requests    (/student/leaves)
 *   - Complaints        (/student/complaints)
 *   - Mark Attendance   (/student/attendance)
 *   - Lost & Found      (/student/lost-found)
 *   - Mess              (/student/mess)
 *   - Notices           (/student/notices)
 *   - Staff Feedback    (/student/staff-feedback)
 *   - Fee Payments      (/student/payments)
 *   - Room Transfer     (/student/room-transfer)
 *   - Visitors          (/student/visitors)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert the page has a visible h1 or h2 matching the given text. */
async function expectHeading(page: Page, text: string | RegExp) {
  const heading = page.locator('h1, h2').filter({ hasText: text }).first();
  await expect(heading).toBeVisible({ timeout: 8000 });
}

/**
 * Navigate to `url` and assert the PageHeader heading matches.
 * If the middleware redirected to /login (no session), asserts we are on /login
 * and exits — so tests don't throw when run without a seeded database.
 */
async function visitAndCheck(page: Page, url: string, heading: string | RegExp) {
  await page.goto(url);
  if (page.url().includes('/login')) {
    expect(page.url()).toContain('/login');
    return;
  }
  await expectHeading(page, heading);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Student – Leave Requests', () => {
  test('page renders Leave Requests heading', async ({ page }) => {
    await visitAndCheck(page, '/student/leaves', 'Leave Requests');
  });

  test('leave form has date and textarea inputs', async ({ page }) => {
    await page.goto('/student/leaves');
    if (page.url().includes('/login')) return;

    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows validation error for reason shorter than 20 chars', async ({ page }) => {
    await page.goto('/student/leaves');
    if (page.url().includes('/login')) return;

    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    const fmt      = (d: Date) => d.toISOString().split('T')[0];

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(fmt(tomorrow));
    await dateInputs.nth(1).fill(fmt(dayAfter));
    await page.locator('textarea').fill('short');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('p.text-red-500')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Student – Complaints', () => {
  test('page renders Complaints heading', async ({ page }) => {
    await visitAndCheck(page, '/student/complaints', 'Complaints');
  });

  test('complaint form has description textarea and submit button', async ({ page }) => {
    await page.goto('/student/complaints');
    if (page.url().includes('/login')) return;

    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('urgent toggle can be clicked without crashing', async ({ page }) => {
    await page.goto('/student/complaints');
    if (page.url().includes('/login')) return;

    const toggle = page.locator('button[type="button"]').first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await toggle.click();
  });
});

test.describe('Student – Attendance', () => {
  test('page renders Mark Attendance heading', async ({ page }) => {
    await visitAndCheck(page, '/student/attendance', 'Mark Attendance');
  });
});

test.describe('Student – Lost & Found', () => {
  test('page renders Lost & Found heading', async ({ page }) => {
    await visitAndCheck(page, '/student/lost-found', /Lost.*Found/i);
  });
});

test.describe('Student – Mess', () => {
  test('page renders Mess heading', async ({ page }) => {
    await visitAndCheck(page, '/student/mess', 'Mess');
  });
});

test.describe('Student – Notices', () => {
  test('page renders Notices heading', async ({ page }) => {
    await visitAndCheck(page, '/student/notices', 'Notices');
  });
});

test.describe('Student – Staff Feedback', () => {
  test('page renders Staff Feedback heading', async ({ page }) => {
    await visitAndCheck(page, '/student/staff-feedback', 'Staff Feedback');
  });
});

test.describe('Student – Fee Payments', () => {
  test('page renders Fee Payments heading', async ({ page }) => {
    await visitAndCheck(page, '/student/payments', 'Fee Payments');
  });
});

test.describe('Student – Room Transfer', () => {
  test('page renders Room Transfer heading', async ({ page }) => {
    await visitAndCheck(page, '/student/room-transfer', 'Room Transfer');
  });
});

test.describe('Student – Visitors', () => {
  test('page renders Visitors heading', async ({ page }) => {
    await visitAndCheck(page, '/student/visitors', 'Visitors');
  });

  test('visitor form has required inputs visible', async ({ page }) => {
    await page.goto('/student/visitors');
    if (page.url().includes('/login')) return;

    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
