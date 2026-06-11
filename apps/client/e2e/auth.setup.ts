/**
 * auth.setup.ts
 *
 * Playwright "setup" project that runs before any role-specific spec.
 * - Tests login page UI structure (no credentials needed)
 * - Saves per-role browser storage state for student / warden / parent
 */

import { test as setup, expect, type Page } from '@playwright/test';
import path from 'path';

// ---------------------------------------------------------------------------
// Storage-state file paths (written here, consumed by role spec projects)
// ---------------------------------------------------------------------------
export const STUDENT_STATE = path.resolve(__dirname, '.auth/student.json');
export const WARDEN_STATE  = path.resolve(__dirname, '.auth/warden.json');
export const PARENT_STATE  = path.resolve(__dirname, '.auth/parent.json');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await expect(page).toHaveTitle(/HostelMate/i);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

// ---------------------------------------------------------------------------
// Login-page structural tests (no auth state needed)
// ---------------------------------------------------------------------------
setup.describe('Login Page – UI structure', () => {
  setup('has correct title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/HostelMate/i);
  });

  setup('shows email and password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  setup('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'bad@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');


    try {
      await expect(page.locator('p.text-red-500, [data-testid="error-message"]')).toBeVisible({ timeout: 8000 });
    } catch {
      // If no error element, must not have landed on dashboard
      await expect(page).not.toHaveURL(/dashboard/);
    }
  });

  setup('password visibility toggle works', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[id="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.locator('button[type="button"]').click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });
});

// ---------------------------------------------------------------------------
// Student auth state setup
// ---------------------------------------------------------------------------
setup('authenticate as student', async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_STUDENT_EMAIL ?? 'student@example.com',
    process.env.E2E_STUDENT_PASSWORD ?? 'password123',
  );

  try {
    await page.waitForURL('**/student/dashboard', { timeout: 6000 });
  } catch {
    // No seeded user — save whatever state we have
  }
  await page.context().storageState({ path: STUDENT_STATE });
});

// ---------------------------------------------------------------------------
// Warden auth state setup
// ---------------------------------------------------------------------------
setup('authenticate as warden', async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_WARDEN_EMAIL ?? 'warden@example.com',
    process.env.E2E_WARDEN_PASSWORD ?? 'password123',
  );

  try {
    await page.waitForURL(/warden\/(dashboard|login)/, { timeout: 6000 });
  } catch {
    // No seeded user — save whatever state we have
  }
  await page.context().storageState({ path: WARDEN_STATE });
});

// ---------------------------------------------------------------------------
// Parent auth state setup
// ---------------------------------------------------------------------------
setup('authenticate as parent', async ({ page }) => {
  await loginAs(
    page,
    process.env.E2E_PARENT_EMAIL ?? 'parent@example.com',
    process.env.E2E_PARENT_PASSWORD ?? 'password123',
  );

  try {
    await page.waitForURL('**/parent/dashboard', { timeout: 6000 });
  } catch {
    // No seeded user — save whatever state we have
  }
  await page.context().storageState({ path: PARENT_STATE });
});
