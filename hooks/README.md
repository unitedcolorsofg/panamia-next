# Hooks Directory

Custom React hooks for shared stateful logic.

## Available Hooks

### `use-toast.ts`

Toast notification system (shadcn/ui):

- `useToast()` - Access toast functions
- `toast({ title, description, variant })` - Show toast notification

```tsx
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: 'Saved',
      description: 'Your changes have been saved.',
    });
  };
}
```

### `use-profile-guard.ts`

Profile requirement checker for protected features:

- `requireProfile(hasProfile, featureName)` - Show toast if profile missing

```tsx
import { useProfileGuard } from '@/hooks/use-profile-guard';

function ProtectedFeature() {
  const { requireProfile } = useProfileGuard();

  // Shows toast if no profile: "Please complete your profile to write articles."
  requireProfile(hasProfile, 'write articles');
}
```

### `use-debounce.ts`

Debounce values for search inputs:

```tsx
import { useDebounce } from '@/hooks/use-debounce';

function SearchInput() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  // Use debouncedQuery for API calls
}
```

### `use-reveal-on-view.ts`

Gate a mount-triggered animation on the element first scrolling into view.
Written for the Impact Report charts: Recharts animates on mount, so a chart
below the fold would otherwise play its whole entrance off-screen.

```tsx
import { useRevealOnView } from '@/hooks/use-reveal-on-view';

function Chart() {
  const { ref, revealed, reducedMotion } = useRevealOnView<HTMLDivElement>();

  // Reserve the height so the reveal does not shift the page.
  return (
    <div ref={ref} style={{ minHeight: 420 }}>
      {revealed && <Bar isAnimationActive={!reducedMotion} />}
    </div>
  );
}
```

`reducedMotion` is separate from `revealed` because a visitor who asked for
reduced motion still needs the content immediately — just without the
animation. It reveals at once and skips the observer entirely.

### `useButtonEvasion.ts`

Flower Power effect - makes buttons evade cursor (fun/brand feature):

```tsx
import { useButtonEvasion } from '@/hooks/useButtonEvasion';

function EvasiveButton() {
  const { ref, style } = useButtonEvasion();
  return (
    <button ref={ref} style={style}>
      Catch me!
    </button>
  );
}
```

## Conventions

- Hooks are prefixed with `use`
- Return objects with named properties (not arrays)
- Handle loading and error states internally when possible
- Use TypeScript for return type definitions
