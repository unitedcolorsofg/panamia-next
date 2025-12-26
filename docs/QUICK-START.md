# Quick Start Guide

Get the Pana Mia Club development environment running on your machine.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js**: Version 20.x or higher ([Download](https://nodejs.org/))
- **Yarn**: Package manager ([Install](https://yarnpkg.com/getting-started/install))
- **MongoDB Atlas Account**: Required for search functionality ([Sign up](https://www.mongodb.com/cloud/atlas))
- **Git**: For version control

> **Note**: MongoDB Atlas is required for full functionality. The directory and admin search features use Atlas Search indexes (`$search` aggregation), which are not available in local MongoDB instances.

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

| Variable          | Description                                |
| ----------------- | ------------------------------------------ |
| `MONGODB_URI`     | MongoDB Atlas connection string (required) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32`    |
| `NEXTAUTH_URL`    | `https://localhost:3000` for development   |
| `PUSHER_*`        | Required for mentoring video features      |
| `EMAIL_SERVER_*`  | Required for authentication emails         |

See `example.env` for all available options with detailed comments.

### 4. Set Up MongoDB Atlas

1. Create free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Configure Atlas Search indexes for the `profiles` collection
4. Get connection string and add to `.env.local` as `MONGODB_URI`
5. Add your IP address to Atlas IP whitelist

---

## Development

### Start Development Server

```bash
npm run dev
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
npm run lint

# Auto-fix linting issues
npm run lint -- --fix

# Format code with Prettier
npx prettier --write .
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
npm test

# Run tests in UI mode (interactive)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# View test report
npm run test:report
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
npm run build

# Start production server
npm start
```

---

## Technology Stack

### Core

| Technology                                           | Version | Purpose                         |
| ---------------------------------------------------- | ------- | ------------------------------- |
| [Next.js](https://nextjs.org/)                       | 16.x    | React framework with App Router |
| [React](https://react.dev/)                          | 19.x    | UI library                      |
| [TypeScript](https://www.typescriptlang.org/)        | 5.x     | Type-safe JavaScript            |
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | -       | NoSQL database                  |
| [Mongoose](https://mongoosejs.com/)                  | 9.x     | MongoDB ODM                     |

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
│   ├── (mentoring)/         # Mentoring feature routes
│   ├── (public)/            # Public pages
│   ├── account/             # User account pages
│   ├── api/                 # API routes
│   ├── directory/           # User directory
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   ├── flower-power/        # Flower Power theme
│   └── *.tsx                # Shared components
├── lib/                     # Utilities
│   ├── model/               # Mongoose schemas
│   ├── validations/         # Zod schemas
│   └── *.ts                 # Utility functions
├── public/                  # Static assets
├── styles/                  # Global styles
├── docs/                    # Documentation
├── tests/                   # Playwright E2E tests
├── middleware.ts            # Next.js middleware
└── package.json             # Dependencies
```

---

## Getting Help

- **Environment Variables**: [Contact us](https://www.panamia.club/form/contact-us/) for a developer ENV file
- **Documentation**: See the [docs/](.) folder
- **Issues**: [GitHub Issues](https://github.com/panamiaclub/panamia.club/issues)
