/**
 * .well-known/gpc.json
 *
 * Advertises Global Privacy Control support per the GPC spec.
 * @see https://privacycg.github.io/gpc-spec/#gpc-support-resource
 */

import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      gpc: true,
      lastUpdate: '2026-04-09',
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    }
  );
}
