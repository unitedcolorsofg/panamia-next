import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Stripe Configuration', () => {
  test('no hard-coded apiVersion in Stripe initialization', async () => {
    const projectRoot = process.cwd();

    // Read the checkout session route
    const checkoutRoutePath = path.join(
      projectRoot,
      'app/api/create-checkout-session/route.ts'
    );
    const checkoutRouteContent = fs.readFileSync(checkoutRoutePath, 'utf-8');

    // Verify there's no hard-coded apiVersion
    // The Stripe SDK should use its bundled default version
    const hasHardcodedVersion = /apiVersion:\s*['"][^'"]+['"]/.test(
      checkoutRouteContent
    );

    expect(hasHardcodedVersion).toBe(false);
  });

  test('Stripe package is installed', async () => {
    const projectRoot = process.cwd();

    const stripePackagePath = path.join(
      projectRoot,
      'node_modules/stripe/package.json'
    );

    // Skip if node_modules not available
    if (!fs.existsSync(stripePackagePath)) {
      console.log(
        'Skipping: node_modules/stripe not found (run npm install first)'
      );
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(stripePackagePath, 'utf-8'));

    // Verify stripe package exists and has a version
    expect(packageJson.name).toBe('stripe');
    expect(packageJson.version).toBeDefined();

    console.log(`Stripe package version: ${packageJson.version}`);
  });

  test('Stripe API version in package is valid format', async () => {
    const projectRoot = process.cwd();

    const stripeApiVersionPath = path.join(
      projectRoot,
      'node_modules/stripe/cjs/apiVersion.js'
    );

    // Skip if node_modules not available
    if (!fs.existsSync(stripeApiVersionPath)) {
      console.log('Skipping: stripe apiVersion.js not found');
      return;
    }

    const content = fs.readFileSync(stripeApiVersionPath, 'utf-8');
    const versionMatch = content.match(/ApiVersion\s*=\s*['"]([^'"]+)['"]/);

    expect(versionMatch).not.toBeNull();
    const apiVersion = versionMatch![1];

    // Stripe API version format: YYYY-MM-DD or YYYY-MM-DD.suffix
    const versionPattern = /^\d{4}-\d{2}-\d{2}(\.\w+)?$/;
    expect(apiVersion).toMatch(versionPattern);

    // Parse and validate the date portion
    const datePart = apiVersion.split('.')[0];
    const date = new Date(datePart);
    expect(date.toString()).not.toBe('Invalid Date');

    // Verify date is reasonable (after Stripe existed, not too far in future)
    const stripeFoundedYear = 2010;
    const maxYear = new Date().getFullYear() + 2;
    expect(date.getFullYear()).toBeGreaterThanOrEqual(stripeFoundedYear);
    expect(date.getFullYear()).toBeLessThanOrEqual(maxYear);

    console.log(`Stripe bundled API version: ${apiVersion}`);
  });
});
