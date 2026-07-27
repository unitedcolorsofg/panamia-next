import { test, expect } from '@playwright/test';

// Public + unauthenticated smoke coverage for the Articles module. No auth
// setup needed: these assert the public surfaces render and that the write
// endpoints reject anonymous callers (the authorization gates exist and fire).
// A full authored-loop e2e (create -> invite -> accept -> publish) needs a
// logged-in session fixture, which this repo doesn't set up yet.

test.describe('Articles — public pages', () => {
  test('browse page (/a) loads', async ({ page }) => {
    await page.goto('/a');
    await expect(page).toHaveURL(/\/a$/);
    await expect(page).not.toHaveTitle(/404/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('RSS feed responds', async ({ request }) => {
    const res = await request.get('/feed.xml');
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('xml');
  });

  test('a nonexistent article is not found', async ({ page }) => {
    const res = await page.goto('/a/this-article-does-not-exist-xyz');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Articles — API rejects anonymous writes', () => {
  test('POST /api/articles requires auth', async ({ request }) => {
    const res = await request.post('/api/articles', {
      data: { title: 'x', articleType: 'community_commentary' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/articles/[slug]/publish requires auth', async ({
    request,
  }) => {
    const res = await request.post('/api/articles/any-slug/publish');
    expect(res.status()).toBe(401);
  });

  test('POST /api/articles/[slug]/coauthors/invite requires auth', async ({
    request,
  }) => {
    const res = await request.post('/api/articles/any-slug/coauthors/invite', {
      data: { userId: 'someone' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/articles/media/upload requires auth', async ({ request }) => {
    const res = await request.post('/api/articles/media/upload', {
      data: {
        filename: 'articles/media/x.png',
        contentType: 'image/png',
        size: 1,
      },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/articles/[slug] hides a nonexistent/non-public article', async ({
    request,
  }) => {
    const res = await request.get('/api/articles/this-does-not-exist-xyz');
    expect(res.status()).toBe(404);
  });
});
