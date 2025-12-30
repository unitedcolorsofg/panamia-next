import { test, expect } from '@playwright/test';

/**
 * Notification System Tests
 *
 * Tests for the ActivityPub-shaped notification system.
 * Most tests verify unauthenticated behavior since auth state
 * requires additional setup with Playwright's storageState.
 */

test.describe('Notifications Page', () => {
  test('notifications page shows unauthorized message for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/account/notifications', {
      waitUntil: 'domcontentloaded',
    });

    // Page should load without 404
    await expect(page).not.toHaveTitle(/404/);

    // Should show unauthorized message (the page handles auth client-side)
    const unauthorizedCard = page.getByText('Unauthorized');
    await expect(unauthorizedCard).toBeVisible({ timeout: 10000 });

    const loginMessage = page.getByText(
      'You must be logged in to view this page.'
    );
    await expect(loginMessage).toBeVisible();
  });

  test('notifications page does not return 404', async ({ page }) => {
    await page.goto('/account/notifications');
    await page.waitForLoadState('networkidle');

    // Should not be a 404 page
    const title = await page.title();
    expect(title).not.toMatch(/404/i);

    const url = page.url();
    expect(url).not.toContain('404');
  });
});

test.describe('Notifications API', () => {
  test('notifications list API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.get('/api/notifications');

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  test('unread count API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.get('/api/notifications/unread-count');

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  test('mark all read API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.post('/api/notifications/mark-all-read');

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  test('mark single notification read API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    // Use a fake notification ID
    const response = await request.post(
      '/api/notifications/507f1f77bcf86cd799439011/read'
    );

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });
});

test.describe('Notifications in Navigation', () => {
  test('Jump To menu is not visible for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for header to load
    await page.waitForSelector('header');

    // Jump To button should not be visible for unauthenticated users
    const jumpToButton = page.getByRole('button', { name: /Jump To/i });
    await expect(jumpToButton).not.toBeVisible();
  });

  test('Sign In button is visible for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for header to load
    await page.waitForSelector('header');

    // Sign In link should be visible (inside a Button with asChild)
    // Use text locator as fallback since the Button wrapper may affect role detection
    const signInLink = page.locator('a:has-text("Sign In")');
    await expect(signInLink).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Notification Routes - No 404', () => {
  test('all notification routes return valid responses', async ({ page }) => {
    const routes = ['/account/notifications'];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Check that we don't get a 404 page
      const title = await page.title();
      expect(title).not.toMatch(/404/i);

      // Also check that the URL is valid
      const url = page.url();
      expect(url).not.toContain('404');
    }
  });
});
