# Styles Directory

Global CSS styles and CSS modules organized by feature.

## Structure

```
styles/
├── globals.css              # Global styles (Tailwind imports, resets)
├── flower-power.css         # Flower Power brand animations
├── *.module.css             # Page-specific CSS modules
├── account/                 # Account page styles
├── admin/                   # Admin page styles
├── event/                   # Event page styles
├── form/                    # Form page styles
├── list/                    # List page styles
└── profile/                 # Profile page styles
```

## Files

### `globals.css`

Global styles loaded in the root layout:

- Tailwind base/components/utilities imports
- CSS custom properties (variables)
- Global resets and defaults
- Dark mode styles

### `flower-power.css`

Brand-specific animations and effects:

- Petal burst animations
- Cursor trail effects
- Button evasion styles

### CSS Modules (`*.module.css`)

Page-specific styles scoped by component:

| Module                 | Page/Feature      |
| ---------------------- | ----------------- |
| `AboutUs.module.css`   | About page        |
| `Directory.module.css` | Directory listing |
| `Donations.module.css` | Donation page     |
| `Links.module.css`     | Link tree page    |
| `Podcasts.module.css`  | Podcasts page     |

## Styling Approach

This project uses a combination of:

1. **Tailwind CSS** - Utility-first styling via class names
2. **CSS Modules** - Scoped styles for specific components (`.module.css`)
3. **Global CSS** - Site-wide defaults in this directory

## Tailwind Configuration

See `tailwind.config.ts` in project root for:

- Custom colors (Pana MIA brand)
- Typography settings
- Animation utilities
- Plugin configurations

## Dark Mode

Dark mode is supported via Tailwind's `dark:` variant:

```tsx
<div className="bg-white dark:bg-gray-900">
```

Theme toggle is handled by `next-themes` package.

## Adding Styles

- **Component-specific**: Use Tailwind classes or CSS modules
- **Global changes**: Add to `globals.css`
- **New utilities**: Extend Tailwind in config file
- **Brand effects**: Add to `flower-power.css`
