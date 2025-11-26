# Migration TODOs

## Completed
- ✅ Next.js 12 → 13 → 14 → 15.5.6
- ✅ Remove unused Mantine packages
- ✅ TypeScript 5.3.3
- ✅ Mongoose 8.0.3
- ✅ React 18 → 19.2.0
- ✅ App Router foundation created
- ✅ Model files moved to lib/ (Next.js 15 requirement)
- ✅ React 19 type compatibility (JSX.Element → React.JSX.Element)

## Pending Cleanup Work

### Link Component Migration (68 instances)
**Priority:** Low (works fine with legacyBehavior)
**Effort:** 2-4 hours
**Status:** Deferred

All `<Link>` components currently use `legacyBehavior` prop for backward compatibility with Next.js 12 patterns.

**Migration needed:**
- 68 total instances across pages/ and components/
- ~40 simple cases (just text children)
- ~28 complex cases (with className, onClick, styling)

**Modern pattern:**
```tsx
// Current (works fine)
<Link legacyBehavior href="/path"><a>Click</a></Link>

// Target (fully modern)
<Link href="/path">Click</Link>
```

**Approach:**
1. Consider automated codemod for simple cases
2. Manual migration for complex cases
3. Or migrate gradually when touching files for other reasons

**Files with most instances:**
- components/MainHeader.tsx
- components/MainFooter.tsx
- pages/directory/search.tsx
- pages/form/*.tsx

---

## Next Phase: Authentication Upgrade

### NextAuth v4 → v5
**Priority:** HIGH
**Effort:** TBD
**Blockers:** None (Next.js 14 now installed)

Required for modern authentication patterns and better App Router integration.

---

## Known Issues

### Next.js 15 Production Build (useRouter prerendering)
**Priority:** MEDIUM
**Status:** Dev server works, production build fails
**Effort:** 2-3 hours

Production build fails with "NextRouter was not mounted" errors during static page generation. Next.js 15 changed automatic static optimization behavior.

**Affected pages:**
- / (homepage)
- /affiliate
- /become-a-pana
- /directory/search_old
- /admin/profile/action

**Root cause:** These pages use `useRouter()` at component initialization, which doesn't work during static generation in Next.js 15's more aggressive optimization.

**Solutions (pick one):**
1. Add `getServerSideProps` to affected pages to force SSR
2. Wrap `useRouter()` calls in `useEffect` hooks
3. Add router.isReady checks before using router
4. Use Next.js codemod: `npx @next/codemod@latest use-router-is-ready .`

### ESLint Next.js Plugin Configuration
**Priority:** LOW
**Status:** Rules disabled in .eslintrc.json

Several Next.js ESLint rules fail due to configuration issues:
- `@next/next/no-html-link-for-pages`
- `@next/next/no-img-element`

These rules expect context that's not being provided correctly. Currently disabled to allow commits.

---

## Future Considerations

### shadcn/ui Components
**Priority:** MEDIUM
**Status:** Ready to implement (Tailwind already configured)

### Remove Google Analytics
**Priority:** LOW (works, just not FLOSS)
**Effort:** 30 minutes

### Mentoring Feature Scaffolding
**Priority:** MEDIUM
**Dependencies:** Authentication stable, WebRTC research needed
