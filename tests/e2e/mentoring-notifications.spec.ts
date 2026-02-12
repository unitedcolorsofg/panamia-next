import { test, expect } from '@playwright/test';

/**
 * Mentoring Notifications Tests
 *
 * Tests for the mentoring session notification flow.
 * Most tests verify unauthenticated behavior since auth state
 * requires additional setup with Playwright's storageState.
 *
 * See docs/TESTING-ROADMAP.md for deferred tests requiring authentication.
 */

test.describe('Mentoring Session API - Authentication', () => {
  test('session booking API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.post('/api/mentoring/sessions', {
      data: {
        mentorEmail: 'mentor@example.com',
        scheduledAt: new Date().toISOString(),
        duration: 60,
        topic: 'Test session topic',
        sessionType: 'knowledge_transfer',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('session respond API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/mentoring/sessions/test-session-id/respond',
      {
        data: {
          action: 'accept',
        },
      }
    );

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('session cancel API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.patch(
      '/api/mentoring/sessions/test-session-id',
      {
        data: {
          action: 'cancel',
          sessionId: 'test-session-id',
          reason: 'Test cancellation',
        },
      }
    );

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('session list API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.get('/api/mentoring/sessions');

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('session details API returns 401 for unauthenticated requests', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/mentoring/sessions/test-session-id'
    );

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });
});

test.describe('Mentoring Pages - Unauthenticated Access', () => {
  test('mentoring schedule page redirects unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/m/schedule');

    // Should redirect to signin page
    await expect(page).toHaveURL(/signin/);
  });

  test('mentoring discover page redirects unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/m/discover');

    // Should redirect to signin page
    await expect(page).toHaveURL(/signin/);
  });

  test('mentoring profile page redirects unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/m/profile');

    // Should redirect to signin page
    await expect(page).toHaveURL(/signin/);
  });

  test('mentoring session page redirects unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/m/session/test-session-id');

    // Should redirect to signin page
    await expect(page).toHaveURL(/signin/);
  });
});

/**
 * DEFERRED TESTS - Require authenticated storageState
 *
 * These tests are documented in docs/TESTING-ROADMAP.md and will be
 * implemented once Playwright authentication state is configured.
 *
 * Deferred tests include:
 * - Session request creates notification for mentor
 * - Session accept creates notification for mentee
 * - Session decline creates notification for mentee
 * - Session cancel creates notification for other party
 * - Pending sessions show Accept/Decline buttons for mentor
 * - Accepted sessions show Join Session button
 * - Notification links navigate to correct pages
 */
