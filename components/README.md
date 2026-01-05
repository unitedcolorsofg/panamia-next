# Components Directory

Reusable React components used throughout the application.

## Structure

```
components/
├── ui/               # Base UI components (shadcn/ui)
├── Admin/            # Admin-specific components
├── Form/             # Form-related components
├── flower-power/     # Pana MIA brand components (flower icons, etc.)
├── Article*.tsx      # Article feature components
├── Mastodon*.tsx     # Mastodon integration components
├── Notification*.tsx # Notification system components
├── *Badge.tsx        # Various badge components
└── [others]          # Feature-specific components
```

## Component Categories

### UI Components (`ui/`)

Base components from shadcn/ui - buttons, inputs, cards, dialogs, etc.
These are the building blocks used by higher-level components.

### Feature Components

- **Article\***: Article editor, cards, bylines, type badges
- **Notification\***: Notification flower, dropdown, list items
- **Mastodon\***: Mastodon comments integration
- **UserSearch**: Search for users (co-authors, reviewers)
- **AuthorBadge**: Display author attribution with verification

### Layout Components

- **HeroBar**: Page header with title and description
- **MainFooter**: Site footer
- **CallToActionBar**: Promotional banners

### Form Components (`Form/`)

Specialized form inputs and widgets for profile editing, etc.

## Conventions

- Components are PascalCase: `ArticleCard.tsx`
- CSS modules use `.module.css` extension
- Client components use `'use client'` directive
- Props interfaces defined in same file or `/types`

## Adding New Components

1. Create component file in appropriate location
2. Add TypeScript props interface
3. Export from component file
4. Consider adding to this README if it's a major component
