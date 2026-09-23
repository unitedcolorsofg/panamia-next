import { test, expect } from '@playwright/test';

/**
 * Notification System Tests
 *
 * Tests for the ActivityPub-shaped notification system.
 * Most tests verify unauthenticated behavior since auth state
 * requires additional setup with Playwright's storageState.
 */

test.describe('Updates Page', () => {
  test('updates page exists and shows unauthorized message for anonymous users', async ({
    page,
  }) => {
    const res = await page.goto('/updates', {
      waitUntil: 'domcontentloaded',
    });

    // Routing and content in one place. Two further tests used to cover the
    // routing half -- 'updates page does not return 404' and a
    // 'Updates Routes - No 404' describe whose route list held a single entry,
    // /updates. Both asserted only `status === 200`, which a static stub
    // answering 200 on every path also satisfies, and both were strictly weaker
    // than this test. Their original title/URL assertions could not fail at all
    // against this app: the not-found page keeps the default "Pana Mia" title
    // and is served in place, with no /404 redirect. Consolidated here so the
    // route's existence is asserted by something that can tell this page from
    // any other page.
    expect(res?.status()).toBe(200);

    const unauthorizedCard = page.getByText('Unauthorized');
    await expect(unauthorizedCard).toBeVisible({ timeout: 10000 });

    const loginMessage = page.getByText(
      'You must be logged in to view this page.'
    );
    await expect(loginMessage).toBeVisible();
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

    // MainHeader renders nothing in the masthead while `status === 'loading'`,
    // and <header> itself is in the SSR HTML, so waiting for it proves nothing
    // about the session. A bare negative assertion here passed before the
    // session resolved -- it would have passed just as well if "Jump To" were
    // shown to every visitor. Wait for the unauthenticated branch to actually
    // render, which is the proof that the gate evaluated, and only then assert
    // the authenticated control is absent.
    await expect(page.locator('a:has-text("Sign In")')).toBeVisible({
      timeout: 15000,
    });

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
