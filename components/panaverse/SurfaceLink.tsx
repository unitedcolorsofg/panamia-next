'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { crossesSurface } from '@/lib/panaverse/surfaces';

/**
 * A link that knows whether it is leaving the surface it sits on.
 *
 * Within a surface it is `next/link` and navigates on the client. When the
 * destination belongs to another surface it renders a plain anchor, so the
 * browser loads the document and the server picks the chrome again.
 *
 * That second case is not a preference. The masthead is resolved in the root
 * layout from the request headers, and the App Router keeps a shared root
 * layout mounted across client navigations — so a `<Link>` out of Pana Social
 * arrives on a Pana Mia page still wearing the Pana Social masthead, and the
 * member has to refresh to get the right one.
 *
 * It exists as a component rather than as a rule because the failure is
 * invisible at the call site: `<Link href="/e">` looks correct, renders
 * correctly, and only misbehaves on the second page. Anything that reaches
 * across surfaces should reach for this instead, and then it cannot be got
 * wrong by someone who has never heard of this problem.
 *
 * It forwards its ref so it stays a drop-in child of `<Button asChild />`,
 * which hands one down.
 */
const SurfaceLink = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<'a'> & { href: string }
>(function SurfaceLink({ href, children, ...rest }, ref) {
  const pathname = usePathname() ?? '/';

  if (crossesSurface(href, pathname)) {
    return (
      <a href={href} ref={ref} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} ref={ref} {...rest}>
      {children}
    </Link>
  );
});

export default SurfaceLink;
