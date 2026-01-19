# Quick Start Guide

Get the Pana Mia Club development environment running on your machine.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js**: Version 20.x or higher ([Download](https://nodejs.org/))
- **Yarn**: Package manager (see setup below)
- **PostgreSQL**: Database (via Neon, Vercel Postgres, or local)
- **Git**: For version control

### Yarn Setup

This project uses Yarn. Enable it via Node.js corepack:

```bash
corepack enable
```

Or install globally:

```bash
npm install -g yarn
```

> **Note**: The CI pipeline uses `yarn install --frozen-lockfile`, so always use Yarn to install dependencies to keep `yarn.lock` in sync.

### Optional Services

These are required for specific features:

| Service                        | Purpose             | Required For          |
| ------------------------------ | ------------------- | --------------------- |
| [Pusher](https://pusher.com/)  | Real-time WebSocket | Mentoring video calls |
| [Stripe](https://stripe.com/)  | Payment processing  | Donations             |
| [BunnyCDN](https://bunny.net/) | File uploads        | Profile images        |
| SMTP Server                    | Email delivery      | Authentication        |

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

### 3. Set Up Environment Variables

```bash
cp example.env .env.local
```

Edit `.env.local` with your credentials. Key configurations:

| Variable          | Description                              |
| ----------------- | ---------------------------------------- |
| `POSTGRES_URL`    | PostgreSQL connection string (required)  |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32`  |
| `NEXTAUTH_URL`    | `https://localhost:3000` for development |
| `PUSHER_*`        | Required for mentoring video features    |
| `EMAIL_SERVER_*`  | Required for authentication emails       |

See `.env.local.example` for all available options with detailed comments.

### 4. Set Up PostgreSQL

**Option A: Neon (Recommended for development)**

1. Create free account at [Neon](https://neon.tech)
2. Create a new project
3. Get connection string and add to `.env.local` as `POSTGRES_URL`

**Option B: Local PostgreSQL**

1. Install PostgreSQL locally
2. Create a database: `createdb panamia_dev`
3. Set `POSTGRES_URL=postgres://localhost:5432/panamia_dev`

**Run migrations:**

```bash
npx prisma migrate deploy
```

---

## Development

### Start Development Server

```bash
yarn dev
```

Open **https://localhost:3000** in your browser.

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

# Format code with Prettier
yarn prettier --write .
```

### Git Hooks

Pre-commit hooks automatically run:

- Prettier formatting
- ESLint checks
- TypeScript compilation check
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

Tests run automatically on every `git push` via GitHub Actions.

```bash
# Run all tests
yarn test

# Run tests in UI mode (interactive)
yarn test:ui

# Run tests in headed mode (see browser)
yarn test:headed

# View test report
yarn test:report
```

### Test Coverage

Current test coverage includes:

- Authentication flows
- Profile creation and editing
- Directory search
- Screenname validation
- Navigation and routing

See [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) for manual testing procedures.

---

## Deployment

### Vercel (Recommended)

**Automatic deployment:**

1. Push to `main` branch
2. Vercel builds and deploys automatically
3. Preview deployments for all branches

**Environment variables** - Set in Vercel dashboard (Settings → Environment Variables):

- All variables from `.env.local`
- Set `NODE_ENV=production`
- Ensure `NEXTAUTH_URL` points to production domain

### Build Locally

```bash
# Create production build
yarn build

# Start production server
yarn start
```

---

## Technology Stack

### Core

| Technology                                    | Version | Purpose                         |
| --------------------------------------------- | ------- | ------------------------------- |
| [Next.js](https://nextjs.org/)                | 16.x    | React framework with App Router |
| [React](https://react.dev/)                   | 19.x    | UI library                      |
| [TypeScript](https://www.typescriptlang.org/) | 5.x     | Type-safe JavaScript            |
| [PostgreSQL](https://www.postgresql.org/)     | 16.x    | Relational database             |
| [Prisma](https://www.prisma.io/)              | 7.x     | Database ORM                    |

### UI & Styling

| Technology                                      | Purpose               |
| ----------------------------------------------- | --------------------- |
| [Tailwind CSS](https://tailwindcss.com/)        | Utility-first CSS     |
| [shadcn/ui](https://ui.shadcn.com/)             | Component library     |
| [Radix UI](https://www.radix-ui.com/)           | Accessible primitives |
| [Lucide Icons](https://lucide.dev/)             | Icon library          |
| [Framer Motion](https://www.framer.com/motion/) | Animations            |

### Authentication & State

| Technology                                      | Purpose           |
| ----------------------------------------------- | ----------------- |
| [NextAuth.js v5](https://next-auth.js.org/)     | Authentication    |
| [TanStack Query](https://tanstack.com/query/)   | Server state      |
| [React Hook Form](https://react-hook-form.com/) | Form handling     |
| [Zod](https://zod.dev/)                         | Schema validation |

### Real-time & Payments

| Technology                    | Purpose             |
| ----------------------------- | ------------------- |
| [Pusher](https://pusher.com/) | WebSocket/real-time |
| [Stripe](https://stripe.com/) | Payment processing  |

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
├── app/                      # Next.js App Router
│   ├── about-us/            # About page
│   ├── account/             # User account settings
│   ├── admin/               # Admin dashboard
│   ├── api/                 # API routes (40+ endpoints)
│   ├── directory/           # Profile directory & search
│   ├── donate/              # Donation pages
│   ├── event/               # Event listings
│   ├── form/                # Business intake forms
│   ├── list/                # User-curated lists
│   ├── mentoring/           # Peer mentoring feature
│   │   ├── discover/        # Find mentors
│   │   ├── profile/         # Mentor profiles
│   │   ├── schedule/        # Booking system
│   │   └── session/         # Video call interface
│   ├── profile/             # Public profile pages
│   ├── signin/              # Authentication
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Homepage
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── flower-power/        # Flower Power theme
│   ├── Admin/               # Admin components
│   ├── Form/                # Form components
│   ├── Page/                # Page layout components
│   └── *.tsx                # Shared components
├── lib/                     # Utilities & business logic
│   ├── validations/         # Zod validation schemas
│   ├── blob/                # Vercel Blob integration
│   ├── query/               # Database queries
│   ├── server/              # Server-side utilities
│   └── *.ts                 # Auth, email, utils
├── prisma/                  # Prisma schema & migrations
├── hooks/                   # Custom React hooks
├── types/                   # TypeScript type definitions
├── styles/                  # Global CSS & theme files
├── public/                  # Static assets (images, logos)
├── scripts/                 # Utility scripts
├── tests/                   # Playwright E2E tests
│   └── e2e/                 # Test specs
├── docs/                    # Documentation
├── .husky/                  # Git hooks (pre-commit, commit-msg)
├── auth.ts                  # NextAuth v5 configuration
├── middleware.ts            # Next.js middleware (HTTPS, headers)
└── package.json             # Dependencies & scripts
```

---

## Getting Help

- **Environment Variables**: [Contact us](https://www.panamia.club/form/contact-us/) for a developer ENV file
- **Documentation**: See the [docs/](.) folder
- **Issues**: [GitHub Issues](https://github.com/panamiaclub/panamia.club/issues)
