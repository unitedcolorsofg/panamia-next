/**
 * Tests for DM live-delivery fan-out.
 *
 * `notifyDirectMessage` runs at the end of `createStatus`, after the row is
 * committed, and `createStatus` awaits it. That placement is what these pin:
 * the fan-out is an enhancement over the ordinary read path, so **every** way
 * it can go wrong must still resolve, and resolve quickly. If it throws, a
 * committed message is reported to the sender as a failed send. If it hangs,
 * the same thing happens more slowly and with the connection held open.
 *
 * The hang case is the one that needs a test rather than a reading: a missing
 * binding, a thrown error and a non-2xx are all *answers*, and the try/catch
 * covers them visibly. A mailbox that accepts the subrequest and never replies
 * produces no error to catch, so only the timeout saves the send — and a
 * regression there would not fail a test, it would hang one. Hence the explicit
 * `timeout` on that case.
 *
 * No network: the Durable Object namespace is a local fake, primed through
 * `getDmStream(env)` exactly as worker/index.ts primes the real one.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { getDmStream, notifyDirectMessage } = await import('@/lib/dm-stream');

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

interface Recorded {
  actorId: string;
  body: { conversationActorId: string | null; statusId: string; at: number };
}

/** Prime the module cache with a namespace whose mailboxes behave as given. */
const prime = (impl: (actorId: string) => FetchImpl) => {
  const seen: Recorded[] = [];
  getDmStream({
    DM_STREAM: {
      // The real `idFromName` returns an opaque id; the only contract the
      // caller relies on is that `get` can turn it back into a stub.
      idFromName: (name: string) => name,
      get: (id: unknown) => {
        const actorId = id as string;
        return {
          fetch: async (input: string, init?: RequestInit) => {
            seen.push({
              actorId,
              body: JSON.parse(String(init?.body)) as Recorded['body'],
            });
            return impl(actorId)(input, init);
          },
        };
      },
    },
  });
  return seen;
};

const ok =
  (delivered: number): FetchImpl =>
  async () =>
    new Response(JSON.stringify({ delivered }), { status: 200 });

describe('notifyDirectMessage', () => {
  // Must run before anything primes the cache: `getDmStream` only ever
  // overwrites with a truthy binding, so the unbound state is not recoverable
  // once set. Worth the ordering constraint -- this is the path plain-Node dev
  // and CI take on every single DM send, and a throw here would break sending
  // locally while production looked fine.
  test('resolves to zero when the binding is absent', async () => {
    const delivered = await notifyDirectMessage(
      [{ actorId: 'actor-a', conversationActorId: 'actor-b' }],
      'status-1'
    );
    assert.equal(delivered, 0);
  });

  test('sums delivered counts across every mailbox', async () => {
    prime(() => ok(2));

    const delivered = await notifyDirectMessage(
      [
        { actorId: 'actor-a', conversationActorId: 'actor-b' },
        { actorId: 'actor-b', conversationActorId: 'actor-a' },
      ],
      'status-2'
    );

    assert.equal(delivered, 4);
  });

  test('addresses each mailbox with its own side of the thread', async () => {
    const seen = prime(() => ok(1));

    await notifyDirectMessage(
      [
        { actorId: 'recipient', conversationActorId: 'author' },
        { actorId: 'author', conversationActorId: 'recipient' },
      ],
      'status-3'
    );

    // A message from A to B belongs to B's thread with A *and* to A's thread
    // with B. Collapsing these to one value would point a client at its own
    // thread, which is the bug this asymmetry exists to prevent.
    assert.deepEqual(
      seen.map((s) => [s.actorId, s.body.conversationActorId]),
      [
        ['recipient', 'author'],
        ['author', 'recipient'],
      ]
    );
    assert.equal(seen[0].body.statusId, 'status-3');
  });

  test('carries no message content', async () => {
    const seen = prime(() => ok(1));

    await notifyDirectMessage(
      [{ actorId: 'actor-a', conversationActorId: 'actor-b' }],
      'status-4'
    );

    // The client refetches through the authenticated query instead, so expiry,
    // blocks, hidden actors and the request gate all still apply. Content on
    // the wire here would route around every one of them.
    assert.deepEqual(Object.keys(seen[0].body).sort(), [
      'at',
      'conversationActorId',
      'statusId',
    ]);
  });

  test('survives a mailbox that throws', async () => {
    prime((actorId) =>
      actorId === 'broken'
        ? async () => {
            throw new Error('DO unreachable');
          }
        : ok(1)
    );

    const delivered = await notifyDirectMessage(
      [
        { actorId: 'broken', conversationActorId: null },
        { actorId: 'fine', conversationActorId: null },
      ],
      'status-5'
    );

    // One mailbox failing must not cost the others their delivery.
    assert.equal(delivered, 1);
  });

  test('survives a mailbox that answers with an error status', async () => {
    prime(() => async () => new Response('nope', { status: 500 }));

    const delivered = await notifyDirectMessage(
      [{ actorId: 'actor-a', conversationActorId: null }],
      'status-6'
    );

    assert.equal(delivered, 0);
  });

  test(
    'gives up on a mailbox that never answers',
    { timeout: 15_000 },
    async () => {
      prime(() => () => new Promise<Response>(() => {}));

      const started = Date.now();
      const delivered = await notifyDirectMessage(
        [{ actorId: 'actor-a', conversationActorId: null }],
        'status-7'
      );
      const elapsed = Date.now() - started;

      // Resolving at all is the assertion. Without the timeout this await never
      // returns, which would hold open a send whose row is already committed --
      // the sender is told their message failed when it did not.
      assert.equal(delivered, 0);
      assert.ok(
        elapsed < 10_000,
        `fan-out should bound itself, took ${elapsed}ms`
      );
    }
  );

  test('skips the round trip when there is nothing to tell', async () => {
    const seen = prime(() => ok(1));

    const delivered = await notifyDirectMessage([], 'status-8');

    assert.equal(delivered, 0);
    assert.equal(seen.length, 0);
  });
});
