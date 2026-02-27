// Shim for bare `import ... from 'next'` — provides Metadata and legacy
// Pages Router API types that are still referenced in a few files.

export type { Metadata, Viewport } from 'vinext/shims/metadata';

// Pages Router API handler types (used by lib/auth-api.ts)
import type { IncomingMessage, ServerResponse } from 'http';

export interface NextApiRequest extends IncomingMessage {
  cookies: Record<string, string>;
  query: Record<string, string | string[]>;
  body: unknown;
}

export interface NextApiResponse<T = unknown> extends ServerResponse {
  send(body: T): void;
  json(data: T): void;
  status(code: number): NextApiResponse<T>;
}
