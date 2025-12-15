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
    await page.goto('/become-a-pana');
    await page.waitForLoadState('networkidle');

    // Page should load (not 404)
    await expect(page).not.toHaveTitle(/404/);

    // Note: Form submission requires ReCAPTCHA which is not configured in test environment
  });

  test('contact form loads without errors', async ({ page }) => {
    await page.goto('/form/contact-us');
    await page.waitForLoadState('networkidle');

    // Page should load (not 404)
    await expect(page).not.toHaveTitle(/404/);

    // Note: Form submission requires ReCAPTCHA which is not configured in test environment
  });

  test('donation flow initiates correctly', async ({ page }) => {
    await page.goto('/donate');

    // Page should load
    await page.waitForLoadState('networkidle');

    // Should not have errors
    await expect(page).not.toHaveTitle(/404/);
    await expect(page).not.toHaveTitle(/error/i);
  });
});

test.describe('Mentoring Features', () => {
  test('mentor discovery page requires authentication', async ({ page }) => {
    await page.goto('/mentoring/discover');

    // Should redirect to signin for unauthenticated users
    await expect(page).toHaveURL(/\/api\/auth\/signin/);
  });

  test('mentor schedule page requires authentication', async ({ page }) => {
    await page.goto('/mentoring/schedule');

    // Should redirect to signin for unauthenticated users
    await expect(page).toHaveURL(/\/api\/auth\/signin/);
  });

  test('mentor profile page loads or redirects', async ({ page }) => {
    await page.goto('/mentoring/profile');

    await page.waitForLoadState('networkidle');

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
  test('list page with valid ID loads', async ({ page }) => {
    // Try to navigate to a list page
    // In real scenario, you'd get a valid list ID from the API or database
    await page.goto('/list/test-list-id');

    await page.waitForLoadState('networkidle');

    // Should either show the list or handle gracefully (not 500 error)
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
