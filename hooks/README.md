# Hooks Directory

Custom React hooks for shared stateful logic.

## Available Hooks

### `useAppContext.ts`

Global application context providing:

- Current user state
- Theme preferences
- Global loading states

### `useProfile.ts`

Profile data fetching and caching:

- Fetch user's own profile
- Cache profile data
- Handle profile updates

## Usage

```tsx
import { useAppContext } from '@/hooks/useAppContext';
import { useProfile } from '@/hooks/useProfile';

function MyComponent() {
  const { user, loading } = useAppContext();
  const { profile, refetch } = useProfile();

  // ...
}
```

## Conventions

- Hooks are prefixed with `use`
- Return objects with named properties (not arrays)
- Handle loading and error states internally when possible
- Use TypeScript for return type definitions
