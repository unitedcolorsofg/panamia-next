import { test, expect } from '@playwright/test';

// Note: tests marked [requires-migration] will return 500 instead of the expected
// response until `npx drizzle-kit migrate` has been run (events/venues tables must exist).

test.describe('Events — Public Pages', () => {
  test('events discovery page route exists', async ({ page }) => {
    const res = await page.goto('/e', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Community Events');
  });

  test('venues discovery page route exists', async ({ page }) => {
    const res = await page.goto('/venues', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Venues');
  });

  test('event detail page returns 404 for unknown slug', async ({ page }) => {
    const res = await page.goto('/e/this-event-does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
    });
    // Either 404 page or error page (pre-migration) — must not be a successful
    // load. The previous `expect(url).toContain('/e/')` only re-checked the
    // path this test had just typed, so a 200 rendering a real event page
    // would have passed it.
    expect(res?.status()).toBeGreaterThanOrEqual(400);
  });

  test('venue detail page returns 404 for unknown slug', async ({ page }) => {
    const res = await page.goto('/venues/this-venue-does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
    });
    expect(res?.status()).toBeGreaterThanOrEqual(400);
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

  test('/e/[slug]/manage redirects unauthenticated users to signin', async ({
    page,
  }) => {
    await page.goto('/e/nonexistent-event/manage');

    // app/e/[slug]/manage/page.tsx checks auth BEFORE looking up the event, so
    // an anonymous visitor always lands on /signin regardless of whether the
    // slug exists. The previous assertion allowed "404 or error" as an
    // alternative, and its `url.includes('/e/')` branch was satisfied by the
    // callbackUrl on the sign-in page itself — so the disjunction was true on
    // every possible outcome, including outcomes this route cannot produce.
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/signin/);
    await expect(page.locator('h1').first()).toContainText(
      'Welcome to Pana MIA'
    );
  });

  test('/e/[slug]/edit redirects unauthenticated users to signin', async ({
    page,
  }) => {
    await page.goto('/e/nonexistent-event/edit');

    // This route is a client component and redirects from a useEffect once the
    // session resolves, so the navigation is not complete on load. toHaveURL
    // retries, but give it room for the session round-trip.
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/signin/, {
      timeout: 15000,
    });
    await expect(page.locator('h1').first()).toContainText(
      'Welcome to Pana MIA'
    );
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

  // RSVP is deliberately open to anonymous callers — they submit
  // {name,email,status} and the RSVP is held PENDING behind a magic link — so
  // this route never returns 401. The event lookup runs first, hence 404.
  test('POST /api/events/[slug]/rsvp 404s for an unknown event', async ({
    request,
  }) => {
    const response = await request.post('/api/events/some-event/rsvp', {
      data: { status: 'going' },
    });
    expect(response.status()).toBe(404);
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
});
