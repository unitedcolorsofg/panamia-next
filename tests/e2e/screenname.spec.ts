import { test, expect } from '@playwright/test';

test.describe('Screenname API Endpoints', () => {
  test('screenname check API validates format - too short', async ({
    request,
  }) => {
    const response = await request.get('/api/user/screenname/check?name=ab');
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.available).toBe(false);
    expect(data.error).toContain('at least 3 characters');
  });

  test('screenname check API validates format - invalid characters', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/user/screenname/check?name=test@user'
    );
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.available).toBe(false);
    expect(data.error).toContain('letters, numbers, underscores, or hyphens');
  });

  test('screenname check API validates format - starts with hyphen', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/user/screenname/check?name=-testuser'
    );
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.available).toBe(false);
    expect(data.error).toContain('cannot start or end');
  });

  test('screenname check API rejects reserved words', async ({ request }) => {
    const response = await request.get('/api/user/screenname/check?name=admin');
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.available).toBe(false);
    expect(data.error).toContain('reserved');
  });

  test('screenname check API accepts valid screenname', async ({ request }) => {
    // Use a random screenname to avoid conflicts with existing users
    const randomName = `testuser_${Date.now()}`;
    const response = await request.get(
      `/api/user/screenname/check?name=${randomName}`
    );
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.available).toBe(true);
    expect(data.error).toBeUndefined();
  });

  test('screenname check API requires name parameter', async ({ request }) => {
    const response = await request.get('/api/user/screenname/check');

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('required');
  });

  test('screenname set API requires authentication', async ({ request }) => {
    const response = await request.post('/api/user/screenname/set', {
      data: { screenname: 'testuser123' },
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Authentication required');
  });

  test('author lookup API returns deleted for invalid ID', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/user/author/000000000000000000000000'
    );
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.deleted).toBe(true);
  });
});

test.describe('Screenname UI Elements', () => {
  test('account edit page shows an unauthorized card to anonymous visitors', async ({
    page,
  }) => {
    const res = await page.goto('/account/user/edit', {
      waitUntil: 'domcontentloaded',
    });

    // `expect(page.url()).toBeTruthy()` cannot fail, and the title check that
    // sat beside it cannot detect this app's not-found page, which keeps the
    // default "Pana Mia" title. Status alone is also not enough -- a stub
    // answering 200 everywhere satisfies it. This route renders a signed-out
    // card in place rather than redirecting, so assert the card. The wording is
    // the settings redesign's (#183).
    expect(res?.status()).toBe(200);
    await expect(
      page.getByText('You need to be signed in').first()
    ).toBeVisible({
      timeout: 15000,
    });
  });

  // This test's entire body was wrapped in `if (url.includes('/account/user/edit'))`.
  // Unauthenticated -- which is how this suite runs, locally and in CI -- that
  // route redirects to a sign-in surface, so the condition is false and the
  // test passes having executed no assertions at all. That is a different
  // failure from a weak assertion: there is no assertion. Skipping it states
  // the true coverage instead of reporting a pass for work never done. It needs
  // the storageState fixture this file's sibling has promised since it was
  // written; restore it there rather than here.
  test.skip('account edit page has expected structure when authenticated', async ({
    page,
  }) => {
    await page.goto('/account/user/edit', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/screenname/i).first()).toBeVisible();
    await expect(page.getByText(/publicly displayed/i).first()).toBeVisible();
  });
});

test.describe('Screenname Validation Rules', () => {
  const validScreennames = [
    'abc',
    'user123',
    'test_user',
    'test-user',
    'User_Name-123',
    'a1b',
    'abcdefghijklmnopqrstuvwx', // 24 chars max
  ];

  const invalidScreennames = [
    { name: 'ab', reason: 'too short' },
    { name: 'a', reason: 'too short' },
    { name: '_test', reason: 'starts with underscore' },
    { name: 'test_', reason: 'ends with underscore' },
    { name: '-test', reason: 'starts with hyphen' },
    { name: 'test-', reason: 'ends with hyphen' },
    { name: 'test user', reason: 'contains space' },
    { name: 'test@user', reason: 'contains @' },
    { name: 'test.user', reason: 'contains dot' },
  ];

  for (const screenname of validScreennames) {
    test(`accepts valid screenname: ${screenname}`, async ({ request }) => {
      const response = await request.get(
        `/api/user/screenname/check?name=${screenname}`
      );
      const data = await response.json();

      // Should pass format validation (may or may not be available)
      expect(response.ok()).toBeTruthy();
      // If not available, it should be because it's taken, not invalid format
      if (!data.available) {
        expect(data.error).not.toContain('characters');
        expect(data.error).not.toContain('cannot start');
      }
    });
  }

  for (const { name, reason } of invalidScreennames) {
    test(`rejects invalid screenname (${reason}): ${name}`, async ({
      request,
    }) => {
      const response = await request.get(
        `/api/user/screenname/check?name=${encodeURIComponent(name)}`
      );
      const data = await response.json();

      expect(response.ok()).toBeTruthy();
      expect(data.available).toBe(false);
      expect(data.error).toBeTruthy();
    });
  }
});

test.describe('Reserved Screennames', () => {
  const reservedNames = [
    'admin',
    'administrator',
    'pana',
    'panamia',
    'support',
    'help',
    'system',
    'moderator',
    'mod',
    'staff',
    'official',
    'anonymous',
    'deleted',
    'former',
    'member',
    'user',
  ];

  for (const name of reservedNames) {
    test(`rejects reserved screenname: ${name}`, async ({ request }) => {
      const response = await request.get(
        `/api/user/screenname/check?name=${name}`
      );
      const data = await response.json();

      expect(response.ok()).toBeTruthy();
      expect(data.available).toBe(false);
      expect(data.error).toContain('reserved');
    });
  }

  test('reserved words are case-insensitive', async ({ request }) => {
    const response = await request.get('/api/user/screenname/check?name=ADMIN');
    const data = await response.json();

    expect(response.ok()).toBeTruthy();
    expect(data.available).toBe(false);
    expect(data.error).toContain('reserved');
  });
});
