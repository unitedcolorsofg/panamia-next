# Pana Mia Club

**The Future is Local - Community platform for South Florida artists and businesses**

[![Next.js](https://img.shields.io/github/package-json/dependency-version/panamiaclub/panamia.club/next?label=Next.js&color=black)](https://nextjs.org/)
[![React](https://img.shields.io/github/package-json/dependency-version/panamiaclub/panamia.club/react?label=React&color=blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/github/package-json/dependency-version/panamiaclub/panamia.club/dev/typescript?label=TypeScript&color=blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-see%20LICENSE-green)](./LICENSE)

---

## Table of Contents

- [About](#about)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [Contact](#contact)

---

## About

Pana Mia Club is a 501(c)(3) non-profit built to support the creation of regenerative and vibrant economies in South Florida.
"The Future is Local" - we connect artists, creatives, and local businesses. This is our core software tool.

This project is:

- **Source Reviewable**: Publicly available to encourage collaboration on local projects
- **Community-Focused**: Built for connecting South Florida artists, venues, and music lovers
- **Accessible**: Following WCAG guidelines and best practices
- **Budget-Conscious**: Using cost-effective, scalable technologies

### Key Features

- **User Profiles & Directory**: Browse and connect with community members
- **Mentoring Platform**: Peer-to-peer video mentoring (prototype)
- **Event Listings**: Integration with Shotgun Live for venue events
- **Authentication**: Secure, passwordless login with NextAuth v5
- **Responsive Design**: Mobile-first, accessible UI with Tailwind CSS

---

## Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/panamiaclub/panamia.club.git
cd panamia.club

# 2. Install dependencies
yarn install

# 3. Set up environment variables
cp example.env .env.local
# Edit .env.local with your credentials

# 4. Start development server
npm run dev

# 5. Open https://localhost:3000
```

**Need help with environment variables?** [Contact us](https://www.panamia.club/form/contact-us/) for a developer ENV file.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js**: Version 20.x or higher ([Download](https://nodejs.org/))
- **Yarn**: Package manager ([Install](https://yarnpkg.com/getting-started/install))
- **MongoDB Atlas Account**: Required for search functionality ([Sign up](https://www.mongodb.com/cloud/atlas))
- **Git**: For version control

**MongoDB Atlas is REQUIRED for full functionality.** The directory and admin search features use Atlas Search indexes (`$search` aggregation), which are not available in local MongoDB instances. Without Atlas, search functionality will not work.

### Optional Services

These are required for full functionality:

- **Pusher Account**: For real-time features (free tier available)
- **Stripe Account**: For payment processing (test mode available)
- **BunnyCDN Account**: For file uploads (optional for local development)
- **Email Service**: For authentication emails (NodeMailer with SMTP or Brevo)

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

This will install all required packages including:

- Next.js, React, TypeScript
- NextAuth for authentication
- MongoDB/Mongoose for database
- Tailwind CSS for styling
- Playwright for testing

### 3. Set Up Environment Variables

Copy the example file and configure:

```bash
cp example.env .env.local
```

Edit `.env.local` with your actual credentials. See `example.env` for all available options and detailed comments.

**Key configurations:**

- **MONGODB_URI**: Must be MongoDB Atlas connection string (required for search)
- **NEXTAUTH_SECRET**: Generate with `openssl rand -base64 32`
- **NEXTAUTH_URL**: Set to `https://localhost:3000` for development
- **PUSHER\_\***: Required for mentoring video features
- **EMAIL*SERVER*\***: Required for authentication

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

The application will be available at **https://localhost:3000**

The dev server includes:

- Hot module replacement (HMR)
- Fast refresh for React components
- Automatic TypeScript compilation
- Error overlay with detailed stack traces

### Code Quality

**Run linter:**

```bash
npm run lint
```

**Auto-fix linting issues:**

```bash
npm run lint -- --fix
```

**Format code with Prettier:**

```bash
npx prettier --write .
```

### Git Hooks (Husky)

Pre-commit hooks automatically run on every commit:

- Prettier formatting
- ESLint checks
- TypeScript compilation check

These ensure code quality before commits are created.

---

## Testing

### End-to-End Tests (Playwright)

Playwright tests are automatically run on every `git push` via GitHub Actions CI/CD pipeline. You can also run them locally:

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

**Important**: Tests will run automatically when you push to GitHub. Check the Actions tab for results.

### Test Coverage

Current test coverage includes:

- Authentication flows
- Profile creation and editing
- Directory search
- Navigation and routing

See `docs/TESTING_CHECKLIST.md` for manual testing procedures.

---

## Deployment

### Vercel Deployment (Recommended)

**Automatic deployment:**

1. Push to `main` branch
2. Vercel automatically builds and deploys
3. Preview deployments for all branches

**Environment variables:**

Set these in Vercel dashboard (Settings → Environment Variables):

- All variables from `.env.local`
- Set `NODE_ENV=production`
- Ensure `NEXTAUTH_URL` points to production domain (HTTPS)

**Deployment requirements:**

- HTTPS is automatically enforced in production via middleware
- All security headers are set automatically
- MongoDB Atlas connection must be from allowed IPs (configure Atlas IP whitelist)

### Build Locally

```bash
# Create production build
npm run build

# Start production server
npm start
```

### Branch Deployments

Every branch pushed to GitHub gets a preview deployment:

- View status in GitHub PR checks
- Access preview URL from PR comments
- Test features before merging

---

## Technology Stack

### Core

- **[Next.js](https://nextjs.org/)**: React framework with App Router
- **[React](https://react.dev/)**: UI library
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe JavaScript
- **[MongoDB Atlas](https://www.mongodb.com/cloud/atlas)**: NoSQL database (required)
- **[Mongoose 9.0.1](https://mongoosejs.com/)**: MongoDB ODM

### UI & Styling

- **[Tailwind CSS 4.1.17](https://tailwindcss.com/)**: Utility-first CSS
- **[shadcn/ui](https://ui.shadcn.com/)**: Component library
- **[Radix UI](https://www.radix-ui.com/)**: Accessible primitives
- **[Lucide Icons](https://lucide.dev/)**: Icon library
- **[Framer Motion](https://www.framer.com/motion/)**: Animations

### Authentication & State

- **[NextAuth.js v5](https://next-auth.js.org/)**: Authentication
- **[TanStack Query](https://tanstack.com/query/)**: Server state management
- **[React Hook Form](https://react-hook-form.com/)**: Form handling
- **[Zod](https://zod.dev/)**: Schema validation

### Real-time & Payments

- **[Pusher](https://pusher.com/)**: WebSocket/real-time communication
- **[Stripe](https://stripe.com/)**: Payment processing

### Testing & Quality

- **[Playwright](https://playwright.dev/)**: E2E testing (runs on every push)
- **[ESLint](https://eslint.org/)**: Code linting
- **[Prettier](https://prettier.io/)**: Code formatting
- **[Husky](https://typicode.github.io/husky/)**: Git hooks

See `docs/FLOSS-ALTERNATIVES.md` for detailed technology choices and alternatives.

---

## Project Structure

```
panamia.club/
├── app/                      # Next.js App Router
│   ├── (mentoring)/         # Mentoring feature group
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
│   ├── logos/               # Logo images
│   └── images/              # Other images
├── styles/                  # Global styles
├── docs/                    # Documentation
│   ├── MENTORING.md         # Mentoring feature guide
│   ├── SECURITY_AUDIT.md    # Security documentation
│   ├── TESTING_CHECKLIST.md # Testing procedures
│   └── FLOSS-ALTERNATIVES.md # Technology choices
├── tests/                   # Playwright E2E tests
├── middleware.ts            # Next.js middleware (HTTPS, headers)
├── next.config.js           # Next.js configuration
└── package.json             # Dependencies
```

---

## Contributing

We welcome contributions from developers!

### Getting Started

1. **Read the guidelines**: See [CONTRIBUTING.md](./docs/CONTRIBUTING.md)
2. **Check existing issues**: [GitHub Issues](https://github.com/panamiaclub/panamia.club/issues)
3. **Create a feature branch**: `git checkout -b feature/your-feature`
4. **Make your changes** with clear commit messages
5. **Push and create a Pull Request**

### Development Workflow

1. Create a feature branch from `main`
2. Make your changes with meaningful commit messages
3. Write tests if applicable
4. Run linter: `npm run lint`
5. Push your branch (Playwright tests will run automatically)
6. Create a Pull Request

### Code Standards

- Follow existing code style
- Use TypeScript for type safety
- Write meaningful commit messages
- Add comments for complex logic
- Update documentation if needed

---

## Documentation

- **[Mentoring Feature Guide](./docs/MENTORING.md)**: Complete guide to mentoring platform
- **[Security Audit](./docs/SECURITY_AUDIT.md)**: Security architecture and considerations
- **[Testing Checklist](./docs/TESTING_CHECKLIST.md)**: Manual testing procedures
- **[FLOSS Alternatives](./docs/FLOSS-ALTERNATIVES.md)**: Technology choices and philosophy
- **[Contributing Guide](./docs/CONTRIBUTING.md)**: How to contribute to the project

---

## Contact

- **Website**: [panamia.club](https://www.panamia.club/)
- **Contact Form**: [panamia.club/form/contact-us](https://www.panamia.club/form/contact-us/)
- **GitHub Issues**: [Report bugs or suggest features](https://github.com/panamiaclub/panamia.club/issues)
- **Security Issues**: Use contact form with subject "SECURITY VULNERABILITY"

---

## License

See [LICENSE](./LICENSE) file for details.

---

## Project Status

**Status**: Active Development
**Production**: Deployed at panamia.club
**Roadmap**: See [GitHub Projects](https://github.com/panamiaclub/panamia.club/projects)

### Recent Updates

- Migrated to Next.js 16 App Router
- Implemented Flower Power psychedelic theme
- Added comprehensive E2E testing with Playwright
- Upgraded to React 19 and NextAuth v5
- Removed Google Analytics (privacy-first)
- Enforced HTTPS-only connections

### Experimental Features

**Peer-to-Peer Mentoring**: Video calling with WebRTC is currently in **prototype stage** and under active development. It may not work in all network configurations and is not yet production-ready. Real-time collaboration includes shared notes and chat during sessions.

---

**Questions?** [Contact us](https://www.panamia.club/form/contact-us/) or open an issue!
