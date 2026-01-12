/**
 * Environment Variable Configuration
 *
 * Single source of truth for all environment variables used in the application.
 * This file documents each variable and where it should be configured:
 *
 * - SECRET: GitHub Secrets (sensitive, encrypted)
 * - VAR: GitHub Variables (non-sensitive, visible in logs)
 * - LOCAL: Only needed for local development
 *
 * Usage:
 * - Run `npm run env:check` to validate required variables
 * - Run `npm run env:workflow` to generate GitHub Actions snippet
 */

export type EnvLocation = 'SECRET' | 'VAR' | 'LOCAL';

export interface EnvVarConfig {
  description: string;
  location: EnvLocation;
  required: boolean;
  defaultValue?: string;
  example?: string;
  docsUrl?: string;
}

export const envConfig: Record<string, EnvVarConfig> = {
  // =============================================================================
  // DATABASE
  // =============================================================================
  MONGODB_URI: {
    description: 'MongoDB connection string',
    location: 'SECRET',
    required: true,
    example:
      'mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority',
  },
  POSTGRES_URL: {
    description: 'PostgreSQL connection string (Vercel Postgres)',
    location: 'SECRET',
    required: false, // Not required until Phase 2 (auth migration)
    example: 'postgres://user:password@host:5432/database?sslmode=require',
    docsUrl: 'https://vercel.com/docs/storage/vercel-postgres',
  },

  // =============================================================================
  // AUTHENTICATION (NextAuth)
  // =============================================================================
  NEXTAUTH_SECRET: {
    description:
      'NextAuth.js encryption secret (generate with: openssl rand -base64 32)',
    location: 'SECRET',
    required: true,
  },
  NEXTAUTH_URL: {
    description: 'Base URL for NextAuth callbacks',
    location: 'VAR',
    required: true,
    defaultValue: 'http://localhost:3000',
  },

  // =============================================================================
  // HOST CONFIGURATION
  // =============================================================================
  NEXT_PUBLIC_HOST_URL: {
    description: 'Public-facing site URL',
    location: 'VAR',
    required: true,
    defaultValue: 'http://localhost:3000',
  },

  // =============================================================================
  // ADMIN
  // =============================================================================
  ADMIN_EMAILS: {
    description: 'Comma-separated list of admin email addresses',
    location: 'SECRET',
    required: true,
    example: 'admin1@example.com,admin2@example.com',
  },

  // =============================================================================
  // OAUTH PROVIDERS - Credentials
  // =============================================================================
  GOOGLE_CLIENT_ID: {
    description: 'Google OAuth client ID',
    location: 'VAR',
    required: false,
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
  },
  GOOGLE_CLIENT_SECRET: {
    description: 'Google OAuth client secret',
    location: 'SECRET',
    required: false,
  },
  APPLE_CLIENT_ID: {
    description: 'Apple OAuth client ID (Services ID)',
    location: 'VAR',
    required: false,
    docsUrl:
      'https://developer.apple.com/account/resources/identifiers/list/serviceId',
  },
  APPLE_CLIENT_SECRET: {
    description: 'Apple OAuth client secret (signed JWT)',
    location: 'SECRET',
    required: false,
  },
  WIKIMEDIA_CLIENT_ID: {
    description: 'Wikimedia OAuth client ID',
    location: 'VAR',
    required: false,
    docsUrl:
      'https://meta.wikimedia.org/wiki/Special:OAuthConsumerRegistration',
  },
  WIKIMEDIA_CLIENT_SECRET: {
    description: 'Wikimedia OAuth client secret',
    location: 'SECRET',
    required: false,
  },
  MASTODON_INSTANCE: {
    description: 'Mastodon instance URL for OAuth',
    location: 'VAR',
    required: false,
    defaultValue: 'https://mastodon.social',
  },
  MASTODON_CLIENT_ID: {
    description: 'Mastodon OAuth client ID',
    location: 'VAR',
    required: false,
  },
  MASTODON_CLIENT_SECRET: {
    description: 'Mastodon OAuth client secret',
    location: 'SECRET',
    required: false,
  },

  // =============================================================================
  // OAUTH PROVIDERS - UI Visibility (NEXT_PUBLIC_*)
  // =============================================================================
  NEXT_PUBLIC_GOOGLE_ENABLED: {
    description: 'Show Google sign-in button',
    location: 'VAR',
    required: false,
    defaultValue: 'false',
  },
  NEXT_PUBLIC_APPLE_ENABLED: {
    description: 'Show Apple sign-in button',
    location: 'VAR',
    required: false,
    defaultValue: 'false',
  },
  NEXT_PUBLIC_WIKIMEDIA_ENABLED: {
    description: 'Show Wikimedia sign-in button',
    location: 'VAR',
    required: false,
    defaultValue: 'false',
  },
  NEXT_PUBLIC_MASTODON_ENABLED: {
    description: 'Show Mastodon sign-in button',
    location: 'VAR',
    required: false,
    defaultValue: 'false',
  },

  // =============================================================================
  // OAUTH PROVIDERS - Trust Level
  // Values: trusted | verification-required | disabled
  // =============================================================================
  OAUTH_GOOGLE: {
    description: 'Google OAuth trust level',
    location: 'VAR',
    required: false,
    defaultValue: 'trusted',
  },
  OAUTH_APPLE: {
    description: 'Apple OAuth trust level',
    location: 'VAR',
    required: false,
    defaultValue: 'trusted',
  },
  OAUTH_WIKIMEDIA: {
    description: 'Wikimedia OAuth trust level',
    location: 'VAR',
    required: false,
    defaultValue: 'verification-required',
  },
  OAUTH_MASTODON_SOCIAL: {
    description: 'Mastodon.social OAuth trust level',
    location: 'VAR',
    required: false,
    defaultValue: 'trusted',
  },

  // =============================================================================
  // RECAPTCHA
  // =============================================================================
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: {
    description: 'Google reCAPTCHA v3 site key (public)',
    location: 'VAR',
    required: true,
    docsUrl: 'https://www.google.com/recaptcha/admin',
  },
  RECAPTCHA_SECRET_KEY: {
    description: 'Google reCAPTCHA v3 secret key',
    location: 'SECRET',
    required: true,
  },

  // =============================================================================
  // EMAIL (SMTP for magic links)
  // =============================================================================
  EMAIL_FROM: {
    description: 'From address for magic link emails',
    location: 'VAR',
    required: false,
    example: 'noreply@example.com',
  },
  EMAIL_SERVER_HOST: {
    description: 'SMTP server hostname',
    location: 'VAR',
    required: false,
  },
  EMAIL_SERVER_PORT: {
    description: 'SMTP server port',
    location: 'VAR',
    required: false,
    defaultValue: '587',
  },
  EMAIL_SERVER_USER: {
    description: 'SMTP username',
    location: 'VAR',
    required: false,
  },
  EMAIL_SERVER_PASSWORD: {
    description: 'SMTP password',
    location: 'SECRET',
    required: false,
  },

  // =============================================================================
  // BREVO (Email Service)
  // =============================================================================
  BREVO_APIKEY: {
    description: 'Brevo (Sendinblue) API key',
    location: 'SECRET',
    required: false,
    docsUrl: 'https://app.brevo.com/settings/keys/api',
  },
  BREVO_SENDEREMAIL: {
    description: 'Brevo sender email address',
    location: 'VAR',
    required: false,
  },
  BREVO_SENDERNAME: {
    description: 'Brevo sender display name',
    location: 'VAR',
    required: false,
  },
  BREVO_ENV: {
    description: 'Brevo environment (DEV or PROD)',
    location: 'VAR',
    required: false,
    defaultValue: 'DEV',
  },

  // =============================================================================
  // BLOB STORAGE (Vercel Blob)
  // =============================================================================
  BLOB_READ_WRITE_TOKEN: {
    description: 'Vercel Blob storage token',
    location: 'SECRET',
    required: true,
    docsUrl: 'https://vercel.com/dashboard/stores',
  },

  // =============================================================================
  // PUSHER (Real-time)
  // =============================================================================
  PUSHER_APP_ID: {
    description: 'Pusher application ID',
    location: 'VAR',
    required: false,
    docsUrl: 'https://dashboard.pusher.com/',
  },
  PUSHER_KEY: {
    description: 'Pusher key (for server auth)',
    location: 'SECRET',
    required: false,
  },
  PUSHER_SECRET: {
    description: 'Pusher secret',
    location: 'SECRET',
    required: false,
  },
  NEXT_PUBLIC_PUSHER_KEY: {
    description: 'Pusher key (public, for client)',
    location: 'VAR',
    required: false,
  },
  NEXT_PUBLIC_PUSHER_CLUSTER: {
    description: 'Pusher cluster region',
    location: 'VAR',
    required: false,
  },

  // =============================================================================
  // STRIPE (Payments)
  // =============================================================================
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: {
    description: 'Stripe publishable key (public)',
    location: 'VAR',
    required: false,
    docsUrl: 'https://dashboard.stripe.com/apikeys',
  },
  STRIPE_SECRET_KEY: {
    description: 'Stripe secret key',
    location: 'SECRET',
    required: false,
  },

  // =============================================================================
  // DEVELOPMENT / TESTING
  // =============================================================================
  USE_MEMORY_MONGODB: {
    description: 'Use in-memory MongoDB for testing (mongodb-memory-server)',
    location: 'VAR',
    required: false,
    defaultValue: 'false',
  },
  USE_MEMORY_POSTGRES: {
    description: 'Use in-memory PostgreSQL for testing (PGLite)',
    location: 'VAR',
    required: false,
    defaultValue: 'false',
  },
  DEV_RECEIVER_EMAIL: {
    description:
      'Development email redirect - ALL emails sent here instead of real recipients',
    location: 'LOCAL',
    required: false,
  },
};

/**
 * Get all variables that should be GitHub Secrets
 */
export function getSecrets(): string[] {
  return Object.entries(envConfig)
    .filter(([_, config]) => config.location === 'SECRET')
    .map(([name]) => name);
}

/**
 * Get all variables that should be GitHub Variables
 */
export function getVars(): string[] {
  return Object.entries(envConfig)
    .filter(([_, config]) => config.location === 'VAR')
    .map(([name]) => name);
}

/**
 * Get all required variables
 */
export function getRequired(): string[] {
  return Object.entries(envConfig)
    .filter(([_, config]) => config.required)
    .map(([name]) => name);
}

/**
 * Check for missing required environment variables
 * Returns array of missing variable names
 */
export function checkEnv(): { missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const [name, config] of Object.entries(envConfig)) {
    const value = process.env[name];
    if (config.required && !value) {
      missing.push(name);
    } else if (!config.required && !value && config.location !== 'LOCAL') {
      // Optional but might be useful
    }
  }

  return { missing, warnings };
}

/**
 * Generate GitHub Actions workflow env snippet
 */
export function generateWorkflowSnippet(): string {
  const lines: string[] = ['env:'];

  // Secrets first
  const secrets = Object.entries(envConfig)
    .filter(([_, config]) => config.location === 'SECRET')
    .sort(([a], [b]) => a.localeCompare(b));

  if (secrets.length > 0) {
    lines.push('  # Secrets');
    for (const [name] of secrets) {
      lines.push(`  ${name}: \${{ secrets.${name} }}`);
    }
  }

  // Then vars
  const vars = Object.entries(envConfig)
    .filter(([_, config]) => config.location === 'VAR')
    .sort(([a], [b]) => a.localeCompare(b));

  if (vars.length > 0) {
    lines.push('  # Variables');
    for (const [name] of vars) {
      lines.push(`  ${name}: \${{ vars.${name} }}`);
    }
  }

  return lines.join('\n');
}
