# Types Directory

TypeScript type definitions and declarations.

## Files

### `next-auth.d.ts`

Extends NextAuth types to include custom user properties:

- User ID from database
- Custom session fields

### `index.ts`

Shared type definitions used across the application.

## Usage

Types are auto-discovered by TypeScript. Import when needed:

```typescript
import type { CustomType } from '@/types';
```

## Conventions

- Use `interface` for object shapes
- Use `type` for unions, intersections, and aliases
- Export all types for use in other files
- Keep types close to their usage when specific to a feature

## Global Types

For types used everywhere, consider adding to:

- `lib/interfaces.ts` - Data model interfaces
- This directory - General utility types

## See Also

- `/lib/interfaces.ts` - Database model interfaces
- TypeScript documentation for advanced patterns
