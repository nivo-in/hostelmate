import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should load the login page and show title', async ({ page }) => {
    // Navigate to the app root (which should redirect to or be the login page depending on your setup)
    await page.goto('/login');

    // Check if the page contains some identifier text, for example "HostelMate" or "Login"
    await expect(page).toHaveTitle(/HostelMate/i);

    // We can also test form presence
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });
});
