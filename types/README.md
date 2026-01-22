# Types Directory

TypeScript type definitions and declarations.

## Files

### `next-auth.d.ts`

Extends NextAuth types to include custom user properties:

- User ID from database
- Custom session fields
- Extended JWT types

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      // ... extended properties
    };
  }
}
```

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
