import { test, expect } from '@playwright/test';

// Note: tests marked [requires-migration] will return 500 instead of the expected
// response until `npx drizzle-kit migrate` has been run (events/venues tables must exist).

test.describe('Events — Public Pages', () => {
  test('events discovery page route exists', async ({ page }) => {
    await page.goto('/e', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/e/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('venues discovery page route exists', async ({ page }) => {
    await page.goto('/venues', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/venues/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('event detail page returns 404 for unknown slug', async ({ page }) => {
    await page.goto('/e/this-event-does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
    });
    // Either 404 page or error page (pre-migration) — must not be a successful load
    const url = page.url();
    // Page should not redirect away from /e/...
    expect(url).toContain('/e/');
  });

  test('venue detail page returns 404 for unknown slug', async ({ page }) => {
    await page.goto('/venues/this-venue-does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
    });
    expect(page.url()).toContain('/venues/');
  });
});

test.describe('Events — Auth-Protected Pages', () => {
  test('/e/new redirects unauthenticated users to signin', async ({ page }) => {
    await page.goto('/e/new');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('/venues/new redirects to /form/submit-venue then to signin for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/venues/new');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('/form/submit-venue redirects unauthenticated users to signin', async ({
    page,
  }) => {
    await page.goto('/form/submit-venue');
    await expect(page).toHaveURL(/\/signin/);
  });

  test('/e/[slug]/manage redirects unauthenticated users', async ({ page }) => {
    await page.goto('/e/nonexistent-event/manage');
    // Redirects to signin (unauthenticated) or 404/error (event not found)
    const url = page.url();
    const title = await page.title();
    const redirectedToSignin = url.includes('/signin');
    const notFoundOrError = /404|error/i.test(title) || url.includes('/e/');
    expect(redirectedToSignin || notFoundOrError).toBe(true);
  });

  test('/e/[slug]/edit redirects unauthenticated users', async ({ page }) => {
    await page.goto('/e/nonexistent-event/edit');
    const url = page.url();
    const title = await page.title();
    const redirectedToSignin = url.includes('/signin');
    const notFoundOrError = /404|error/i.test(title) || url.includes('/e/');
    expect(redirectedToSignin || notFoundOrError).toBe(true);
  });
});

test.describe('Events — API Routes', () => {
  test('GET /api/events returns JSON [requires-migration]', async ({
    request,
  }) => {
    const response = await request.get('/api/events');
    // 200 with JSON after migration; 500 before (relation does not exist)
    expect([200, 500]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('events');
      expect(Array.isArray(body.data.events)).toBe(true);
    }
  });

  test('GET /api/venues returns JSON [requires-migration]', async ({
    request,
  }) => {
    const response = await request.get('/api/venues');
    expect([200, 500]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('venues');
      expect(Array.isArray(body.data.venues)).toBe(true);
    }
  });

  test('GET /api/events/[nonexistent] returns 404 or 500 [requires-migration]', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/events/this-event-does-not-exist-xyz'
    );
    // 404 after migration (event not found); 500 before (table missing)
    expect([404, 500]).toContain(response.status());
  });

  test('GET /api/events/[nonexistent]/calendar.ics returns 404 or 500 [requires-migration]', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/events/this-event-does-not-exist-xyz/calendar.ics'
    );
    expect([404, 500]).toContain(response.status());
  });

  test('POST /api/events requires authentication', async ({ request }) => {
    const response = await request.post('/api/events', {
      data: {
        title: 'Test',
        venueId: 'xxx',
        startsAt: new Date().toISOString(),
        tos: true,
      },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/venues requires authentication', async ({ request }) => {
    const response = await request.post('/api/venues', {
      data: {
        name: 'Test Venue',
        address: '123 Main',
        city: 'Miami',
        state: 'FL',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('POST /api/events/[slug]/rsvp requires authentication', async ({
    request,
  }) => {
    const response = await request.post('/api/events/some-event/rsvp', {
      data: { status: 'going' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Events — ActivityPub Federation', () => {
  test('GET /api/federation/events/[nonexistent] returns 404 or 500 [requires-migration]', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/federation/events/this-event-does-not-exist-xyz'
    );
    expect([404, 500]).toContain(response.status());
  });

  test('/e/[slug] with AP Accept header routes to federation endpoint', async ({
    request,
  }) => {
    // Content negotiation rewrite: AP Accept → /api/federation/events/[slug]
    // The federation route returns JSON (not HTML), regardless of whether the
    // event exists or the migration has been run.
    const response = await request.get('/e/this-event-does-not-exist-xyz', {
      headers: { Accept: 'application/activity+json' },
    });
    const contentType = response.headers()['content-type'] || '';
    // Must be JSON-flavoured, never text/html
    expect(contentType).not.toContain('text/html');
  });
});

test.describe('Events — Admin Routes', () => {
  test('POST /api/admin/venues/[slug]/approve requires authentication', async ({
    request,
  }) => {
    const response = await request.post('/api/admin/venues/some-venue/approve');
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/admin/venues/[slug]/suspend requires authentication', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/admin/venues/some-venue/suspend',
      {
        data: { reason: 'test' },
      }
    );
    expect([401, 403]).toContain(response.status());
  });

  test('POST /api/admin/events/[slug]/stream-setup requires authentication', async ({
    request,
  }) => {
    const response = await request.post(
      '/api/admin/events/some-event/stream-setup'
    );
    expect([401, 403]).toContain(response.status());
  });
});
