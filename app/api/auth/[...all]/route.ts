import { handler } from '@/auth';
import { toNextJsHandler } from 'better-auth/next-js';

const authHandler = toNextJsHandler(handler);

// Every response here is session-scoped, and better-auth sets no Cache-Control
// of its own. Without this, Workers Cache stores get-session under a key that
// ignores cookies and serves one visitor's session to everyone.
function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const GET = async (...args: Parameters<typeof authHandler.GET>) =>
  noStore(await authHandler.GET(...args));

export const POST = async (...args: Parameters<typeof authHandler.POST>) =>
  noStore(await authHandler.POST(...args));
