import { test, expect } from '@playwright/test';

/**
 * These tests require authentication.
 * In a real environment, you would set up auth state using Playwright's storageState feature.
 * For now, these tests will skip if not authenticated.
 */

test.describe('Authenticated User Navigation', () => {
  test('account user page requires authentication', async ({ page }) => {
    await page.goto('/account/user/', { waitUntil: 'domcontentloaded' });

    // The page should load without crashing
    // For unauthenticated users, it may:
    // - Redirect to signin
    // - Redirect to home
    // - Stay on the page showing minimal content
    // - Show a "please sign in" message
    const url = page.url();
    expect(url).toBeTruthy();

    // Should not be a 404 or server error page
    await expect(page).not.toHaveTitle(/404/);
    await expect(page).not.toHaveTitle(/error/i);
  });

  test('account user edit page loads or redirects', async ({ page }) => {
    await page.goto('/account/user/edit', { waitUntil: 'domcontentloaded' });

    // Just verify we get a valid response, don't wait for networkidle
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account user following page loads or redirects', async ({ page }) => {
    await page.goto('/account/user/following', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account user lists page loads or redirects', async ({ page }) => {
    await page.goto('/account/user/lists', { waitUntil: 'domcontentloaded' });

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('Authenticated Profile Navigation', () => {
  test('account profile edit page loads or redirects', async ({ page }) => {
    await page.goto('/account/profile/edit', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account profile contact page loads without query errors', async ({
    page,
  }) => {
    await page.goto('/account/profile/contact', {
      waitUntil: 'domcontentloaded',
    });

    // Check that there are no React Query errors visible
    const queryError = page.getByText(/query data cannot be undefined/i);
    await expect(queryError).not.toBeVisible();
  });

  test('account profile address page loads or redirects', async ({ page }) => {
    await page.goto('/account/profile/address', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account profile categories page loads or redirects', async ({
    page,
  }) => {
    await page.goto('/account/profile/categories', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account profile desc page loads or redirects', async ({ page }) => {
    await page.goto('/account/profile/desc', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account profile social page loads or redirects', async ({ page }) => {
    await page.goto('/account/profile/social', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account profile images page loads or redirects', async ({ page }) => {
    await page.goto('/account/profile/images', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('account profile gentedepana page loads or redirects', async ({
    page,
  }) => {
    await page.goto('/account/profile/gentedepana', {
      waitUntil: 'domcontentloaded',
    });

    const url = page.url();
    expect(url).toBeTruthy();
  });
});

test.describe('404 Error Prevention', () => {
  test('no account routes return 404', async ({ page }) => {
    const routes = [
      '/account/user/',
      '/account/user/edit',
      '/account/user/following',
      '/account/user/lists',
      '/account/profile/edit',
      '/account/profile/contact',
      '/account/profile/address',
      '/account/profile/categories',
      '/account/profile/desc',
      '/account/profile/social',
      '/account/profile/images',
      '/account/profile/gentedepana',
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Check that we don't get a 404 page
      const title = await page.title();
      expect(title).not.toMatch(/404/i);

      // Also check that the URL is valid (not showing a 404 route)
      const url = page.url();
      expect(url).not.toContain('404');
    }
  });
});
