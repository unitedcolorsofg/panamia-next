# Styles Directory

Global CSS styles and Tailwind configuration.

## Files

### `globals.css`

Global styles loaded in the root layout:

- Tailwind base/components/utilities imports
- CSS custom properties (variables)
- Global resets and defaults
- Dark mode styles

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
