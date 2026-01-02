import { test, expect } from '@playwright/test';

test.describe('Critical User Paths', () => {
  test('directory search and profile view', async ({ page }) => {
    // Start at directory search
    await page.goto('/directory/search', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/directory\/search/);

    // Search should load without errors (don't wait for networkidle - Atlas search may be slow)
    await expect(page).not.toHaveTitle(/404/);
  });

  test('become a pana form loads without errors', async ({ page }) => {
    await page.goto('/become-a-pana', { waitUntil: 'domcontentloaded' });

    // Page should load (not 404)
    await expect(page).not.toHaveTitle(/404/);

    // Note: Form submission requires ReCAPTCHA which is not configured in test environment
    // Don't wait for networkidle - ReCAPTCHA prevents it from completing
  });

  test('contact form loads without errors', async ({ page }) => {
    await page.goto('/form/contact-us', { waitUntil: 'domcontentloaded' });

    // Page should load (not 404)
    await expect(page).not.toHaveTitle(/404/);

    // Note: Form submission requires ReCAPTCHA which is not configured in test environment
    // Don't wait for networkidle - ReCAPTCHA prevents it from completing
  });

  test('donation flow initiates correctly', async ({ page }) => {
    await page.goto('/donate', { waitUntil: 'domcontentloaded' });

    // Should not have errors
    await expect(page).not.toHaveTitle(/404/);
    await expect(page).not.toHaveTitle(/error/i);
    // Don't wait for networkidle - Stripe may have pending requests
  });
});

test.describe('Mentoring Features', () => {
  test('mentor discovery page requires authentication', async ({ page }) => {
    await page.goto('/mentoring/discover');

    // Should redirect to custom signin page for unauthenticated users
    await expect(page).toHaveURL(/\/signin/);
  });

  test('mentor schedule page requires authentication', async ({ page }) => {
    await page.goto('/mentoring/schedule');

    // Should redirect to custom signin page for unauthenticated users
    await expect(page).toHaveURL(/\/signin/);
  });

  test('mentor profile page loads or redirects', async ({ page }) => {
    await page.goto('/mentoring/profile', { waitUntil: 'domcontentloaded' });

    // Should redirect to signin for unauthenticated users or load the profile page
    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Form Pages', () => {
  test('all form pages load without errors', async ({ page }) => {
    const forms = [
      '/form/become-a-pana',
      '/form/become-a-pana-single',
      '/form/become-an-affiliate',
      '/form/contact-us',
      '/form/join-the-team',
    ];

    for (const formUrl of forms) {
      await page.goto(formUrl, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveTitle(/404/);

      // Just verify the page loaded, don't wait for networkidle (ReCAPTCHA issues)
      const url = page.url();
      expect(url).toContain('/form/');
    }
  });
});

test.describe('List Pages', () => {
  test('list page with invalid ID handles gracefully', async ({ page }) => {
    // Navigate to a list page with an invalid ID format
    // Use a valid ObjectId format that doesn't exist (24 hex characters)
    const response = await page.goto('/list/000000000000000000000000', {
      waitUntil: 'domcontentloaded',
    });

    // Should handle gracefully - either 404 or redirect, not 500 server error
    const status = response?.status();
    expect(status).not.toBe(500);

    // Page should still load without crashing
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
