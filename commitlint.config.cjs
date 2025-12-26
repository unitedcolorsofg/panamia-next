/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Enforce scope is required
    'scope-empty': [2, 'never'],
    // Enforce scope is from the allowed list
    'scope-enum': [
      2,
      'always',
      [
        // Core user system
        'auth',           // Authentication, sign-in, sessions, magic links, OAuth
        'user',           // User model, account settings, screenname
        'profile',        // Public profiles, pana pages, verification

        // Discovery & collections
        'directory',      // Profile search, filters, discovery
        'lists',          // User-curated profile collections
        'search',         // Search functionality across features

        // Mentoring marketplace
        'mentoring',      // Mentor profiles, discover, scheduling, sessions, booking

        // Community content (planned)
        'articles',       // Community articles, co-authors, peer-review
        'comments',       // Comment system (future)

        // Events & calendar
        'events',         // Event creation, discovery, calendar

        // Notifications
        'notifications',  // Notification system, pana flower button

        // Forms & intake
        'forms',          // Business intake forms (restaurant, artisan, etc.)

        // Financial
        'donations',      // Donation tiers, Stripe integration

        // Administration
        'admin',          // Admin dashboard, user management, moderation

        // Infrastructure & tooling
        'api',            // API routes, middleware
        'db',             // Database, models, migrations
        'ui',             // Shared UI components, design system
        'email',          // Email templates, sending
        'config',         // Configuration, environment
        'deps',           // Dependencies, package updates
        'ci',             // CI/CD, GitHub Actions
        'test',           // Testing infrastructure, Playwright
        'docs',           // Documentation
        'build',          // Build configuration, bundling
        'hooks',          // Git hooks, husky

        // Catch-all for misc changes
        'misc',           // Miscellaneous changes that don't fit elsewhere
      ],
    ],
    // Type must be one of the conventional types
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Code style (formatting, semicolons, etc.)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Build system or external dependencies
        'ci',       // CI configuration
        'chore',    // Maintenance tasks
        'revert',   // Revert a previous commit
      ],
    ],
  },
};
