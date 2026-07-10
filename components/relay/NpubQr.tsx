'use client';

import { useState } from 'react';
// Named import — react-qr-code@2.x is CJS and only exports `QRCode` by name; a
// default import resolves to `undefined` under Vite's strict interop and throws
// React #130 on mount. See components/relay/EnrollSection.tsx for the gory note.
import { QRCode } from 'react-qr-code';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

// Renders a profile's Nostr public key (npub) as a scannable QR plus the
// copyable bech32 string. Shown only for relay-enrolled profiles — the caller
// gates on a non-null nostr_pubkey. Takes the already-encoded `npub` (never the
// raw hex pubkey) so hex is never rendered or serialized into the page; callers
// convert at the boundary with npubFromHex().
export function NpubQr({ npub }: { npub: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(npub);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / permissions) — the npub is
      // still selectable in the code block, so just leave the button idle.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nostr identity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-md border bg-white p-3">
            <QRCode value={npub} size={144} aria-label="Nostr npub QR code" />
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-muted-foreground text-sm">
              Scan to follow on Nostr, or copy the npub below. This is the
              public key — safe to share.
            </p>
            <div className="flex items-stretch gap-2">
              <code className="bg-muted/50 min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-xs break-all">
                {npub}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copy}
                aria-label="Copy npub"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
