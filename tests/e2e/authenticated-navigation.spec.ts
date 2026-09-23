import { test, expect } from '@playwright/test';

/**
 * These tests require authentication.
 * In a real environment, you would set up auth state using Playwright's storageState feature.
 * For now, these tests will skip if not authenticated.
 */

test.describe('Authenticated User Navigation', () => {
  test('account user page requires authentication', async ({ page }) => {
    const res = await page.goto('/account/user/', {
      waitUntil: 'domcontentloaded',
    });

    // The page should load without crashing. Unauthenticated visitors are sent
    // to a sign-in surface rather than being shown the account page.
    //
    // Note: this route lands on /api/auth/signin (better-auth's own endpoint),
    // not the custom /signin page that /m/schedule and /become-a-pana use, and
    // the callbackUrl comes back as /account/user/edit rather than the
    // /account/user/ that was requested. The source is
    // components/Page/Status401_Unauthorized.tsx, which router.replace()s to
    // `/api/auth/signin?callbackUrl=...` -- every /account/* route inherits it.
    // That is pre-existing behaviour, not something this test changes: the old
    // `not.toHaveTitle(/404/)` assertion passed straight through it. Flagged
    // rather than fixed here; pointing that component at /signin would be a
    // one-line app change, and is Jose's call rather than a test-only decision.
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/(api\/auth\/)?signin/);
  });

  test('account user edit page shows an unauthorized card to anonymous visitors', async ({
    page,
  }) => {
    const res = await page.goto('/account/user/edit', {
      waitUntil: 'domcontentloaded',
    });

    // This route does NOT redirect -- it renders an Unauthorized card in place,
    // like /form/become-an-affiliate. `expect(page.url()).toBeTruthy()` stood
    // here, which no navigation can fail; status alone replaced it, which a
    // stub answering 200 everywhere also satisfies. The card's own text is the
    // assertion that distinguishes this page from any other page.
    expect(res?.status()).toBe(200);
    await expect(page.getByText('Unauthorized').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByText('You must be logged in to view this page.').first()
    ).toBeVisible();
  });
});

test.describe('Authenticated Profile Navigation', () => {
  // Every /account/* route below renders components/Page/Status401_Unauthorized
  // for anonymous visitors, which shows an UNAUTHORIZED card and then
  // router.replace()s to a sign-in surface. So unauthenticated runs cannot
  // assert route-specific content -- all eight routes produce the same page.
  // What they CAN assert is that the account page is not served to an anonymous
  // visitor, which is the actual security-relevant behaviour and is what
  // `expect(res?.status()).toBe(200)` alone did not check: a stub answering 200
  // everywhere satisfied it. Asserting route-specific content here needs the
  // storageState fixture this file's header has promised since it was written.
  const signInSurface = /^https?:\/\/[^/]+\/(api\/auth\/)?signin/;

  test('account profile edit page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/edit', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });

  test('account profile contact page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/contact', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });

    // Check that there are no React Query errors visible. On its own this was
    // the test's only assertion, and a negative visibility check passes on any
    // page that does not contain the string -- including a blank one.
    const queryError = page.getByText(/query data cannot be undefined/i);
    await expect(queryError).not.toBeVisible();
  });

  test('account profile address page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/address', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });

  test('account profile categories page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/categories', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });

  test('account profile desc page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/desc', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });

  test('account profile social page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/social', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });

  test('account profile images page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/images', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });

  test('account profile gentedepana page sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/account/profile/gentedepana', {
      waitUntil: 'domcontentloaded',
    });

    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(signInSurface, { timeout: 15000 });
  });
});

// The '404 Error Prevention' describe that stood here looped all ten
// /account/* routes asserting only that each returned 200. Every one of those
// routes already has its own test above asserting status AND the sign-in
// redirect that actually protects it, so the loop asserted strictly less than
// what it duplicated -- and a static stub answering 200 on every path passed
// it. Its original form checked the document title and URL string for '404',
// neither of which can detect this app's not-found page: it keeps the default
// "Pana Mia" title and is served in place, with no /404 redirect. Removed
// rather than rewritten, because the per-route tests are the stronger version
// of the same claim.
