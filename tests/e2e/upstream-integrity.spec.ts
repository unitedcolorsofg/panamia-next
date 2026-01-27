import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Upstream Integrity', () => {
  test('external/activities.next exists and was properly added', async () => {
    // Skip in CI if explicitly disabled
    if (process.env.SKIP_UPSTREAM_CHECK === 'true') {
      test.skip();
      return;
    }

    const externalPath = path.join(process.cwd(), 'external/activities.next');

    // Check if external directory exists
    expect(fs.existsSync(externalPath)).toBe(true);

    // Get the subtree commit hash
    const subtreeLog = execSync(
      'git log -1 --format="%H" -- external/activities.next',
      { encoding: 'utf-8' }
    ).trim();

    // Verify subtree was properly added (Git SHA is 40 characters)
    expect(subtreeLog.length).toBe(40);
  });

  test('no uncommitted changes to external code', async () => {
    // Skip in CI if explicitly disabled
    if (process.env.SKIP_UPSTREAM_CHECK === 'true') {
      test.skip();
      return;
    }

    const status = execSync('git diff --name-only external/activities.next', {
      encoding: 'utf-8',
    }).trim();

    expect(status).toBe('');
  });

  test('no staged changes to external code', async () => {
    // Skip in CI if explicitly disabled
    if (process.env.SKIP_UPSTREAM_CHECK === 'true') {
      test.skip();
      return;
    }

    const staged = execSync(
      'git diff --cached --name-only external/activities.next',
      {
        encoding: 'utf-8',
      }
    ).trim();

    expect(staged).toBe('');
  });
});
