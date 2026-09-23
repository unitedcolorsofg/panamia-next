import { test, expect } from '@playwright/test';

test.describe('Public Navigation', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pana Mia/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about-us');
    await expect(page).toHaveURL(/about-us/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('directory search loads', async ({ page }) => {
    await page.goto('/directory/search');
    await expect(page).toHaveURL(/directory\/search/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('donate page loads', async ({ page }) => {
    await page.goto('/donate');
    await expect(page).toHaveURL(/donate/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('affiliate page loads', async ({ page }) => {
    await page.goto('/affiliate');
    await expect(page).toHaveURL(/affiliate/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('become a pana form loads', async ({ page }) => {
    await page.goto('/become-a-pana');
    await expect(page).toHaveURL(/become-a-pana/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('contact form loads', async ({ page }) => {
    await page.goto('/form/contact-us');
    await expect(page).toHaveURL(/form\/contact-us/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('/contact-us redirects to the contact form', async ({ page }) => {
    await page.goto('/contact-us');
    await expect(page).toHaveURL(/form\/contact-us/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('links page loads', async ({ page }) => {
    await page.goto('/links');
    await expect(page).toHaveURL(/links/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('podcasts page loads', async ({ page }) => {
    await page.goto('/podcasts');
    await expect(page).toHaveURL(/podcasts/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('terms of service loads', async ({ page }) => {
    await page.goto('/legal/terms');
    await expect(page).toHaveURL(/legal\/terms/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('old terms URL redirects to new location', async ({ page }) => {
    await page.goto('/doc/terms-and-conditions');
    await expect(page).toHaveURL(/legal\/terms/);
  });

  test('privacy policy loads', async ({ page }) => {
    await page.goto('/legal/privacy');
    await expect(page).toHaveURL(/legal\/privacy/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('DMCA policy loads', async ({ page }) => {
    await page.goto('/legal/dmca');
    await expect(page).toHaveURL(/legal\/dmca/);
    await expect(page).not.toHaveTitle(/404/);
  });

  test('affiliate terms loads', async ({ page }) => {
    await page.goto('/doc/affiliate-terms-and-conditions');
    await expect(page).toHaveURL(/doc\/affiliate-terms-and-conditions/);
    await expect(page).not.toHaveTitle(/404/);
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
      await expect(page).toHaveURL(/\/p\/.+/);
      await expect(page).not.toHaveTitle(/404/);
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
    await page.goto('/signin');
    await expect(page).toHaveURL(/signin/);
    await expect(page).not.toHaveTitle(/404/);
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
    await page.goto('/signin?callbackUrl=/m/discover');

    // Page should load without errors
    await expect(page).not.toHaveTitle(/404/);
    await expect(page).toHaveURL(/callbackUrl/);
  });
});
