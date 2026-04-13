/**
 * NodeInfo Discovery Endpoint
 *
 * UPSTREAM REFERENCE: external/activities.next/app/api/well-known/nodeinfo/route.ts
 * Returns the NodeInfo links document pointing to the 2.0 schema endpoint.
 * Required for federation discovery — remote servers query this to find
 * the nodeinfo schema URL.
 *
 * @see https://nodeinfo.diaspora.software/protocol
 */

import { NextResponse } from 'next/server';
import { socialConfig } from '@/lib/federation';
import { corsHeaders } from '@/lib/federation/cors';

export async function GET() {
  return NextResponse.json(
    {
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: `https://${socialConfig.domain}/.well-known/nodeinfo/2.0`,
        },
      ],
    },
    {
      headers: {
        ...corsHeaders('GET'),
        'Cache-Control': 'max-age=3600',
      },
    }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders('GET', 'OPTIONS'),
  });
}
