# App Directory

Next.js 14+ App Router directory containing all pages, layouts, and API routes.

## Structure

```
app/
├── api/              # API routes (server-side endpoints)
├── account/          # Authenticated user pages (profile, settings, articles)
├── admin/            # Admin-only pages
├── affiliate/        # Affiliate partner pages
├── articles/         # Community articles feature
├── directory/        # Business directory browsing
├── mentoring/        # Mentorship program pages
├── form/             # Public forms (contact, signup, etc.)
├── feed.xml/         # RSS feed routes
├── feed.json/        # JSON feed routes
├── signin/           # Authentication pages
└── [other pages]     # Various public pages
```

## Conventions

- **page.tsx**: The main component rendered for a route
- **layout.tsx**: Shared layout wrapping child routes
- **loading.tsx**: Loading UI shown while route loads
- **error.tsx**: Error boundary for route errors
- **route.ts**: API route handler (in api/ subdirectories)

## Key Patterns

### Dynamic Routes

Folders with `[param]` contain dynamic segments:

- `[slug]` - Article or profile slug
- `[id]` - Database ID
- `[handle]` - User profile handle

### Route Groups

Folders with `(name)` are route groups that don't affect URL:

- Used for organizing related routes
- Sharing layouts without URL nesting

## See Also

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- `/docs/ARTICLE-ROADMAP.md` - Articles feature documentation
- `/docs/MENTORING-ROADMAP.md` - Mentoring feature documentation
