# Types Directory

TypeScript type definitions and declarations.

## Files

### `auth.d.ts`

Re-exports the `AppSession` type from `@/auth` (the better-auth instance), which
augments the base session with custom user properties:

- User ID from database
- `isAdmin`, `panaVerified`, and `roles` (enriched from the profiles table)

```typescript
import type { AppSession } from '@/auth';
```

### `css-modules.d.ts`

Type declarations for `*.module.css` imports.

### `next-fetch.d.ts`

Type augmentation for the vinext fetch/request shims.

## Usage

Type declarations in this directory are auto-discovered by TypeScript.
No explicit imports needed for declaration files (`.d.ts`).

## Conventions

- Use `.d.ts` files for type augmentation (extending library types)
- Use `interface` for object shapes
- Use `type` for unions, intersections, and aliases

## Related Type Locations

| Location            | Purpose                           |
| ------------------- | --------------------------------- |
| `types/*.d.ts`      | Library type augmentation         |
| `lib/interfaces.ts` | Application data model types      |
| `lib/types/`        | Feature-specific type modules     |
| Component files     | Component prop types (co-located) |

## See Also

- `/lib/interfaces.ts` - Database model interfaces
- `/lib/types/` - Feature-specific types
- TypeScript documentation for declaration files
