'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { PANA_SITES, type PanaSite } from '@/lib/panaverse/sites';

/**
 * Carries the server-resolved Pana sites to the account menu.
 *
 * The menu is a client component several levels below the root layout, and the
 * hrefs it needs can only be built on the server: `originForFrom` reads
 * PANAVERSE_ROOT_DOMAIN, a Worker var that is absent from a client bundle. The
 * same constraint drove `SurfaceSwitcher` to take its `href` as a prop; this
 * is that idea as context, because the account menu is reached through two
 * different mastheads (`MainHeader` and `SurfaceIdentity`) and prop-drilling
 * it through both would mean four components carrying a value none of them use.
 *
 * The default is the relative registry rather than an empty list or a throw.
 * That matters: if this provider is ever dropped, the menu keeps rendering
 * every site and every link still resolves, because every route answers on
 * every hostname. What is lost is only the origin hop — the failure degrades
 * to the behaviour this app had before the surface subdomains existed, rather
 * than to a blank grid or a crash.
 */
const PanaSitesContext = createContext<readonly PanaSite[]>(PANA_SITES);

export function PanaSitesProvider({
  sites,
  children,
}: {
  /** Output of `resolvePanaSites(host)`, called on the server. */
  sites: readonly PanaSite[];
  children: ReactNode;
}) {
  return (
    <PanaSitesContext.Provider value={sites}>
      {children}
    </PanaSitesContext.Provider>
  );
}

export function usePanaSites(): readonly PanaSite[] {
  return useContext(PanaSitesContext);
}
