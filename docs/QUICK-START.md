# Quick Start Guide

Get the Pana Mia Club development environment running on your machine.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js**: Version 20.x or higher ([Download](https://nodejs.org/))
- **Yarn**: Package manager (see setup below)
- **PostgreSQL**: Database (Supabase recommended — see below)
- **Git**: For version control

### Yarn Setup

This project uses Yarn. Enable it via Node.js corepack:

```bash
corepack enable
```

> **Note**: The CI pipeline uses `yarn install --frozen-lockfile`, so always use Yarn to install dependencies to keep `yarn.lock` in sync.

### Optional Services

These are required for specific features:

| Service                                                                      | Purpose               | Required For          |
| ---------------------------------------------------------------------------- | --------------------- | --------------------- |
| [Stripe](https://stripe.com/)                                                | Payment processing    | Donations             |
| [Cloudflare Email Sending](https://developers.cloudflare.com/email-service/) | Transactional email   | Authentication emails |
| [Cloudflare R2](https://developers.cloudflare.com/r2/)                       | Object storage        | File uploads          |
| [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)       | DB connection pooling | Production only       |

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/panamiaclub/panamia.club.git
cd panamia.club
```

### 2. Install Dependencies

```bash
yarn install
```

### Federation Subtree

The `external/activities.next/` directory contains a vendored copy of [activities.next](https://github.com/llun/activities.next), pinned to a specific upstream commit. The full source is committed to this repo, so no extra fetch is needed after cloning.

`yarn install` automatically configures the `activities-upstream` git remote. To pull newer upstream changes:

```bash
yarn subtree:pull
```

### 3. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials. Key configurations:

| Variable               | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `POSTGRES_URL`         | Supabase session pooler connection string                          |
| `POSTGRES_DIRECT_URL`  | Supabase direct (unpooled) connection string — for migrations only |
| `BETTER_AUTH_SECRET`   | Generate with `openssl rand -base64 32`                            |
| `BETTER_AUTH_URL`      | `http://localhost:3000` for development                            |
| `NEXT_PUBLIC_HOST_URL` | `http://localhost:3000` for development                            |
| `EMAIL_SENDER_ADDRESS` | Sender email address for CF Email Sending                          |
| `R2_ACCOUNT_ID`        | Cloudflare account ID                                              |
| `R2_ACCESS_KEY_ID`     | R2 API token key ID (R2 → Manage R2 API Tokens)                    |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret                                                |
| `R2_BUCKET_NAME`       | R2 bucket name (`panamia-media`)                                   |
| `R2_PUBLIC_URL`        | Public bucket URL (enable Public Development URL in R2 dashboard)  |

See `.env.local.example` for all available options with detailed comments.

### 4. Set Up PostgreSQL (Supabase)

1. Create a free account at [Supabase](https://supabase.com)
2. Create a new project
3. Go to **Project Settings → Database → Connection string**
4. Copy the **Session Pooler** string (port 5432) → `POSTGRES_URL`
5. Copy the **Direct** string (port 5432, unpooled) → `POSTGRES_DIRECT_URL`

> **Important**: Do NOT use the Transaction Pooler (port 6543) — postgres.js uses prepared statements which are incompatible with transaction mode.

**Run migrations:**

```bash
npx drizzle-kit migrate
```

---

## Development

### Start Development Server

```bash
yarn dev:vinext
```

Open **http://localhost:3001** in your browser.

The dev server includes:

- Hot module replacement (HMR)
- Fast refresh for React components
- Automatic TypeScript compilation
- Error overlay with detailed stack traces

### Code Quality

```bash
# Run linter
yarn lint

# Auto-fix linting issues
yarn lint --fix
```

### Git Hooks

Pre-commit hooks automatically run:

- Prettier formatting
- ESLint checks
- Emoji character check (unicode escapes in JS/TS template literals are allowed)
- Playwright test coverage warnings

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat(articles): add co-author invitation system
fix(auth): resolve OAuth callback redirect
```

See [FEATURES.md](./FEATURES.md) for available scopes.

---

## Testing

### End-to-End Tests (Playwright)

Tests run automatically on every `git push` via GitHub Actions CI (`.github/workflows/playwright.yml`).

#### Local Prerequisites

Before running tests locally, ensure `.dev.vars` exists with your DB and auth secrets:

```
POSTGRES_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_HOST_URL=http://localhost:3000
```

The playwright config starts the dev server automatically via `yarn dev` (legacy Node.js server on port 3000).

#### Run Tests

```bash
# Run all tests
yarn test

# Run tests in UI mode (interactive)
yarn test:ui

# View test report after a run
yarn test:report
```

### Test Coverage

Current test coverage includes:

- Authentication flows
- Profile creation and editing
- Directory search
- Screenname validation
- Navigation and routing
- Events
- Mentoring/notifications

See [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) for manual testing procedures.

---

## Deployment

### Cloudflare Workers

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/) via the Vinext build pipeline.

**Deploy:**

```bash
yarn deploy:vinext
```

This runs `drizzle-kit migrate` then `vinext deploy` (Vite build + wrangler publish).

**Environment variables** — set in the Cloudflare dashboard:

- Workers & Pages → `<app>` → Settings → **Variables and secrets** (CF-RUNTIME)
- Workers & Pages → `<app>` → Settings → **Build → Variables and secrets** (CF-BUILD, for `NEXT_PUBLIC_*` vars baked at build time)

**Cloudflare dashboard build command:**

```
yarn deploy:vinext
```

**Database connection pooling** — configure a [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) binding in `wrangler.jsonc`:

```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<your-hyperdrive-id>" }]
```

**Object storage** — create the R2 bucket and configure CORS:

```bash
npx wrangler r2 bucket create panamia-media
npx wrangler r2 bucket create panamia-media-preview
```

Enable **Public Development URL** on `panamia-media` in the Cloudflare dashboard to get `R2_PUBLIC_URL`. Create an R2 API token (R2 → Manage R2 API Tokens, Object Read & Write) for `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`. The `R2_BUCKET` binding in `wrangler.jsonc` is used automatically in Workers — credentials are only needed for presigned URL generation and local Node.js dev.

### Build Locally

```bash
# Create production build only (no deploy)
yarn build

# Start production server locally
yarn start
```

---

## Technology Stack

### Core

| Technology                                     | Version | Purpose                                    |
| ---------------------------------------------- | ------- | ------------------------------------------ |
| [Vinext](https://github.com/cloudflare/vinext) | 0.0.x   | Vite-based build/deploy CLI for CF Workers |
| [React](https://react.dev/)                    | 19.x    | UI library                                 |
| [TypeScript](https://www.typescriptlang.org/)  | 5.x     | Type-safe JavaScript                       |
| [PostgreSQL](https://www.postgresql.org/)      | 16.x    | Relational database (Supabase)             |
| [Drizzle ORM](https://orm.drizzle.team/)       | 0.44    | Database ORM + migrations                  |

### UI & Styling

| Technology                                      | Purpose                    |
| ----------------------------------------------- | -------------------------- |
| [Tailwind CSS](https://tailwindcss.com/)        | Utility-first CSS          |
| [shadcn/ui](https://ui.shadcn.com/)             | Component library          |
| [Radix UI](https://www.radix-ui.com/)           | Accessible primitives      |
| [Lucide Icons](https://lucide.dev/)             | Icon library               |
| [Framer Motion](https://www.framer.com/motion/) | Animations                 |
| [i18next](https://www.i18next.com/)             | EN/ES internationalization |

### Authentication & State

| Technology                                      | Purpose           |
| ----------------------------------------------- | ----------------- |
| [better-auth](https://www.better-auth.com/)     | Authentication    |
| [TanStack Query](https://tanstack.com/query/)   | Server state      |
| [React Hook Form](https://react-hook-form.com/) | Form handling     |
| [Zod](https://zod.dev/)                         | Schema validation |

### Payments & Email

| Technology                                                                   | Purpose             |
| ---------------------------------------------------------------------------- | ------------------- |
| [Stripe](https://stripe.com/)                                                | Payment processing  |
| [Cloudflare Email Sending](https://developers.cloudflare.com/email-service/) | Transactional email |

### Testing & Quality

| Technology                                 | Purpose                |
| ------------------------------------------ | ---------------------- |
| [Playwright](https://playwright.dev/)      | E2E testing            |
| [ESLint](https://eslint.org/)              | Code linting           |
| [Prettier](https://prettier.io/)           | Code formatting        |
| [Husky](https://typicode.github.io/husky/) | Git hooks              |
| [Commitlint](https://commitlint.js.org/)   | Commit message linting |

See [FLOSS-ALTERNATIVES.md](./FLOSS-ALTERNATIVES.md) for technology choices and alternatives.

---

## Project Structure

```
panamia.club/
├── app/                      # App Router (API routes + pages)
│   ├── about-us/            # About page
│   ├── account/             # User account settings
│   ├── admin/               # Admin dashboard
│   ├── api/                 # API routes (40+ endpoints)
│   ├── directory/           # Profile directory & search
│   ├── donate/              # Donation pages
│   ├── e/                   # Events module
│   ├── form/                # Business intake forms
│   ├── list/                # User-curated lists
│   ├── m/                   # Mentoring module
│   │   ├── discover/        # Find mentors
│   │   ├── profile/         # Mentor profiles
│   │   ├── schedule/        # Booking system
│   │   └── session/         # Video call interface
│   ├── p/                   # Public profile pages
│   ├── signin/              # Authentication
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Homepage
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── social/              # Social feed components
│   ├── Admin/               # Admin components
│   ├── Form/                # Form components
│   └── *.tsx                # Shared components
├── lib/                     # Utilities & business logic
│   ├── schema/              # Drizzle schema (TypeScript)
│   ├── validations/         # Zod validation schemas
│   ├── query/               # TanStack Query hooks
│   ├── federation/          # ActivityPub federation
│   └── *.ts                 # Auth, db, i18n, utils
├── locales/                 # i18next translation files
│   ├── en/                  # English (common.json, toast.json, …)
│   └── es/                  # Spanish
├── drizzle/                 # Drizzle migration files
├── worker/                  # CF Workers entry (auto-generated by vinext)
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript type definitions
├── styles/                  # Global CSS & theme files
├── public/                  # Static assets (images, logos)
├── scripts/                 # Utility scripts
├── tests/                   # Playwright E2E tests
│   └── e2e/                 # Test specs
├── external/                # Vendored upstream code
│   └── activities.next/     # Federation (git subtree)
├── docs/                    # Documentation
├── .husky/                  # Git hooks (pre-commit, commit-msg)
├── auth.ts                  # better-auth configuration
├── proxy.ts                 # Request proxy (HTTPS headers, ActivityPub routing)
├── vite.config.ts           # Vite build config (vinext + cloudflare plugins)
├── wrangler.jsonc           # Cloudflare Workers config
└── package.json             # Dependencies & scripts
```

---

## Getting Help

- **Environment Variables**: [Contact us](https://pana.social/form/contact-us/) for a developer ENV file
- **Documentation**: See the [docs/](.) folder
- **Issues**: [GitHub Issues](https://github.com/panamiaclub/panamia.club/issues)
