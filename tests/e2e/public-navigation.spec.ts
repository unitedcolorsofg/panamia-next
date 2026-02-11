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

  test('terms and conditions loads', async ({ page }) => {
    await page.goto('/doc/terms-and-conditions');
    await expect(page).toHaveURL(/doc\/terms-and-conditions/);
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

  test('signin page has OAuth provider buttons', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Check for OAuth buttons (they may be disabled if not configured)
    // Wait longer for client-side hydration
    const googleButton = page.getByRole('button', {
      name: /Continue with Google/i,
    });
    const appleButton = page.getByRole('button', {
      name: /Continue with Apple/i,
    });

    await expect(googleButton).toBeVisible({ timeout: 15000 });
    await expect(appleButton).toBeVisible({ timeout: 15000 });
  });

  test('signin page has email sign-in option', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Check for email sign-in toggle button - wait for hydration
    const emailButton = page.getByRole('button', {
      name: 'Sign in with email',
    });
    await expect(emailButton).toBeVisible({ timeout: 15000 });

    // The email form is toggled via React state - verify the toggle exists
    // Full form interaction requires authenticated test environment
  });

  test('signin page has terms link', async ({ page }) => {
    await page.goto('/signin', { waitUntil: 'domcontentloaded' });

    // Find terms link (may have trailing slash) - wait for hydration
    const termsLink = page
      .locator('a[href^="/doc/terms-and-conditions"]')
      .first();
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
    await page.goto('/signin?callbackUrl=/mentoring/discover');

    // Page should load without errors
    await expect(page).not.toHaveTitle(/404/);
    await expect(page).toHaveURL(/callbackUrl/);
  });
});
