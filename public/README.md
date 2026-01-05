# Public Directory

Static assets served directly by Next.js.

## Structure

```
public/
├── CosaHecha/        # SVG illustrations and artwork
├── icons/            # App icons and favicons
├── images/           # Static images
├── fonts/            # Custom web fonts
└── [root files]      # favicon.ico, robots.txt, etc.
```

## Usage

Files in this directory are served from the root URL:
- `public/images/logo.png` → `https://site.com/images/logo.png`

In code:
```tsx
<Image src="/images/logo.png" alt="Logo" />
```

## Asset Categories

### CosaHecha
SVG illustrations from the Cosa Hecha art collection.
Used throughout the site for visual identity.

### Icons
App icons for various platforms:
- Favicon
- Apple touch icons
- PWA manifest icons

### Images
Static images that don't need to be processed:
- Background patterns
- Decorative elements
- Placeholder images

## Notes

- Files here are NOT processed by webpack/Next.js
- Use `next/image` for optimized image loading
- Large files increase initial bundle size
- Consider Vercel Blob for user-uploaded content
