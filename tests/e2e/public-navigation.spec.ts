import { test, expect } from '@playwright/test';

// These tests used to assert `not.toHaveTitle(/404/)` plus a `toHaveURL`
// substring. Both were inert:
//
//   - This app's not-found page renders <h1>404 - Page Not Found</h1> but keeps
//     the default <title>Pana Mia</title>. A title-based 404 check therefore
//     never fired on the page it was written to catch. Measured directly
//     against /form/become-a-pana-single, a route that 404s today.
//   - An unanchored toHaveURL matched the path anywhere in the URL, including
//     inside a query string, so /become-a-pana "passed" while sitting on
//     /signin?callbackUrl=/form/become-a-pana.
//
// Together they passed against a stub server that served one static page for
// every route (14 of 24 tests in this file, measured). Each test now asserts
// the HTTP status and a heading only that route renders, so a wrong page, a
// blank page and a 404 all fail. The URL is asserted only where a redirect is
// the behaviour under test, and anchored to the origin so a callbackUrl cannot
// satisfy it.

test.describe('Public Navigation', () => {
  test('homepage loads successfully', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Pana Mia/i);
    await expect(page.locator('h1').first()).toContainText('The Future');
  });

  test('about page loads', async ({ page }) => {
    const res = await page.goto('/about-us');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('About Us');
  });

  test('directory search loads', async ({ page }) => {
    const res = await page.goto('/directory/search');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Find your people');
  });

  test('donate page loads', async ({ page }) => {
    const res = await page.goto('/donate');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('MAKE A DONATION');
  });

  // /affiliate is a redirect shim: it banks an affiliate code in localStorage
  // and then router.replace()s away. The old test asserted toHaveURL(/affiliate/),
  // which only passed by catching the transient pre-redirect URL — it asserted
  // the page had not done the one thing it exists to do.
  test('affiliate link forwards to the homepage', async ({ page }) => {
    const res = await page.goto('/affiliate?code=e2e-smoke');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
    await expect(page.locator('h1').first()).toContainText('The Future');
  });

  test('become a pana form sends anonymous visitors to sign in', async ({
    page,
  }) => {
    const res = await page.goto('/become-a-pana');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/signin\?callbackUrl=/);
    await expect(page.locator('h1').first()).toContainText(
      'Welcome to Pana MIA'
    );
  });

  test('contact form loads', async ({ page }) => {
    const res = await page.goto('/form/contact-us');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Contact Us');
  });

  test('/contact-us redirects to the contact form', async ({ page }) => {
    const res = await page.goto('/contact-us');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/form\/contact-us\/?$/);
    await expect(page.locator('h1').first()).toContainText('Contact Us');
  });

  test('links page loads', async ({ page }) => {
    const res = await page.goto('/links');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toHaveText('Pana MIA Club');
  });

  test('podcasts page loads', async ({ page }) => {
    const res = await page.goto('/podcasts');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText(
      'Pana MIA Club Podcasts'
    );
  });

  test('terms of service loads', async ({ page }) => {
    const res = await page.goto('/legal/terms');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Terms of Service');
  });

  test('old terms URL redirects to new location', async ({ page }) => {
    const res = await page.goto('/doc/terms-and-conditions');
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/legal\/terms\/?$/);
    await expect(page.locator('h1').first()).toContainText('Terms of Service');
  });

  test('privacy policy loads', async ({ page }) => {
    const res = await page.goto('/legal/privacy');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('Privacy Policy');
  });

  test('DMCA policy loads', async ({ page }) => {
    const res = await page.goto('/legal/dmca');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText('DMCA Policy');
  });

  test('affiliate terms loads', async ({ page }) => {
    const res = await page.goto('/doc/affiliate-terms-and-conditions');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText(
      'Terms and Conditions'
    );
  });
});

test.describe('Profile Pages', () => {
  test('profile page with valid handle loads', async ({ page }) => {
    // Navigate to directory first to find a valid profile
    await page.goto('/directory/search');

    // Wait for any profile links to appear
    const profileLink = page.locator('a[href^="/p/"]').first();

    // If a profile exists, test it
    if ((await profileLink.count()) > 0) {
      await profileLink.click();
      await expect(page).toHaveURL(/^https?:\/\/[^/]+\/p\/[^?#]+/);
      // Profile headings are user data, so there is no fixed string to assert.
      // Key the negative on the marker this app's not-found page actually
      // renders instead of on the document title, which stays "Pana Mia".
      // Scoped to body rather than h1 because not every page in this app
      // renders an h1, and a missing element fails a `.not.` assertion.
      await expect(page.locator('body')).not.toContainText('Page Not Found');
    } else {
      // Skip if no profiles exist
      test.skip();
    }
  });
});

test.describe('Navigation Links', () => {
  test('homepage has navigation menu', async ({ page }) => {
    await page.goto('/');

    // Check that main navigation exists (adjust selectors as needed)
    const nav = page.locator('nav, header').first();
    await expect(nav).toBeVisible();
  });
});

test.describe('Custom Sign-In Page', () => {
  test('signin page loads successfully', async ({ page }) => {
    const res = await page.goto('/signin');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText(
      'Welcome to Pana MIA'
    );
  });

  test('signin page displays Pana MIA branding', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Check for welcome message - wait longer for client-side hydration
    const welcomeText = page.getByText('Welcome to Pana MIA');
    await expect(welcomeText).toBeVisible({ timeout: 15000 });
  });

  // These two tests previously asserted that Google and Apple buttons were
  // always present, and that the email option was always a toggle. Both
  // described the old sign-in page, which rendered every provider whether or
  // not it had credentials, so an unconfigured deployment showed four dead
  // controls above the one path that always works. signin-view.tsx now filters
  // to configured providers, which means neither the buttons nor the toggle
  // exist in an environment with no OAuth secrets — CI being exactly that.
  // Asserting on a specific provider therefore tests the runner's env, not the
  // page. What the page actually guarantees is the two invariants below, and
  // they hold whether zero or four providers are configured.

  test('signin page never renders an unusable OAuth button', async ({
    page,
  }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Wait for hydration via something unconditional before counting, so an
    // empty result means "none rendered" rather than "not rendered yet".
    await expect(page.getByText('Welcome to Pana MIA')).toBeVisible({
      timeout: 15000,
    });

    const deadProviderButtons = page.getByRole('button', {
      name: /^Continue with /,
      disabled: true,
    });
    await expect(deadProviderButtons).toHaveCount(0);
  });

  test('signin page always offers an email sign-in path', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // isVisible() does not auto-wait, so gate on something unconditional
    // first. Without this the toggle check can resolve false purely because
    // React has not hydrated, silently skipping the click and leaving the
    // assertion below to fail 15s later for the wrong reason.
    await expect(page.getByText('Welcome to Pana MIA')).toBeVisible({
      timeout: 15000,
    });

    const emailInput = page.getByPlaceholder('your@email.com');
    const emailToggle = page.getByRole('button', {
      name: 'Sign in with email',
    });

    // With OAuth configured the form sits behind a toggle; with none it is
    // opened directly, because a toggle guarding the only option is a dead
    // click. Accept either route, then assert the destination is the same.
    if (await emailToggle.isVisible()) {
      await emailToggle.click();
    }

    await expect(emailInput).toBeVisible({ timeout: 15000 });
  });

  test('signin page has terms link', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Find terms link (may have trailing slash) - wait for hydration
    const termsLink = page.locator('a[href^="/legal/terms"]').first();
    await expect(termsLink).toBeVisible({ timeout: 15000 });
  });

  test('signin page has contact help link', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Find the "Contact us" link in the signin card (not footer) - wait for hydration
    const contactLink = page.locator('.max-w-md a[href^="/form/contact-us"]');
    await expect(contactLink).toBeVisible({ timeout: 15000 });
  });

  test('signin page preserves callback URL', async ({ page }) => {
    // Navigate to signin with a callback URL
    const res = await page.goto('/signin?callbackUrl=/m/discover');

    // The sign-in page renders and keeps the callback rather than dropping it
    // on a redirect.
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toContainText(
      'Welcome to Pana MIA'
    );
    await expect(page).toHaveURL(
      /^https?:\/\/[^/]+\/signin\?callbackUrl=(\/|%2F)m(\/|%2F)discover$/
    );
  });
});
