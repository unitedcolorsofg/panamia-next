# Chat — Design & Roadmap

> **STATUS**: **Proposal. Nothing here is implemented.** No migration, table, route, Durable Object,
> or component described below exists yet.
>
> **Where chat lives is deliberately undecided.** This document covers how real-time messaging
> should be built in this repo — key custody, transport, persistence, and authentication — but not
> which surface it hangs off. See [Open Questions](#risks--open-questions).
>
> This material was extracted from `docs/GROUPS-ROADMAP.md`, where it was originally phase 5. Groups
> ship without it. The two features share a membership model if and only if chat ends up scoped to
> groups, which is itself an open question.

## Table of Contents

- [Overview](#overview)
- [Why Nostr Cannot Back In-App Chat](#why-nostr-cannot-back-in-app-chat)
- [Precedent — SignalingRoom](#precedent--signalingroom)
- [Proposed Design](#proposed-design)
- [Schema](#schema)
- [Do Not Copy The Signaling Auth Model](#do-not-copy-the-signaling-auth-model)
- [Roadmap](#roadmap)
- [Risks & Open Questions](#risks--open-questions)

---

## Overview

Panas should be able to talk to each other in real time without installing anything. The constraint
that decides most of what follows was stated by the product owner:

> _"I don't want users to leave the pana system, so I'd rather build the chat and groups in our
> site."_

Today there is **no chat UI anywhere in this repo.** The closest thing that ships is
`/r/groups`, which hands panas a deeplink to a third-party Nostr client —
`components/relay/ImportInstructions.tsx:7` hardcodes
`https://web.nostrord.com/?relay=relay.pana.social&group=panamia-test`. Nostrord, Amethyst, and
0xchat are where the talking currently happens, which is precisely the outcome the constraint rules
out.

### Goals

- Real-time messaging inside pana.social — no app install, no client handoff
- Messages are in Postgres, so they can be moderated, searched, and swept on account deletion
- Identity is established server-side and cannot be forged by the client
- Runs on the Cloudflare Workers free plan

### Non-Goals

- Threads, reactions, read receipts, or typing indicators in the first release
- Federation. Chat is explicitly the "stay on the site" surface, and ActivityPub has no good
  real-time chat story
- Replacing `/r/groups`. Relay groups stay as a separate bring-your-own-client feature for panas who
  want censorship-resistant Nostr rooms

---

## Why Nostr Cannot Back In-App Chat

The obvious shortcut is to keep the relay and build a chat UI on top of it here. That is blocked,
and the block is deliberate.

`components/relay/EnrollSection.tsx:450` tells every enrolling pana:

> _"Your secret key (nsec) is shown once. We don't store it."_

And `:398` — _"never sent to or stored on our servers."_ The schema backs the promise: `profiles`
carries `nostrPubkey` and `nostrPubkeySource` (`lib/schema/index.ts:684-685`) and no secret-key
column anywhere.

Signing a kind-9 group message requires that secret in the browser on **every visit**. Every way to
put it there is unacceptable:

| Approach                    | Why it fails                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Paste the nsec each session | Trains panas to type secret keys into web forms — the exact habit that gets people drained |
| Keep it in `localStorage`   | Any XSS anywhere on the origin becomes total, permanent identity compromise                |
| Store it server-side        | Breaks a promise made in the product UI                                                    |
| Require a NIP-07 extension  | Another install — back to "leave the pana system"                                          |

`lib/nostr/sign.ts` and `lib/nostr/publish-browser.ts` are both capable — browser schnorr signing
and a NIP-42 AUTH WebSocket publisher already exist. Capability was never the problem. **Key
custody is.**

**Conclusion: in-app chat must be native Postgres + Durable Object.**

---

## Precedent — SignalingRoom

`worker/signaling-room.ts` is a SQLite-backed Durable Object that already implements WebSocket
handling, a `chat` table, a `participants` table, join-with-reconnect that refreshes `joined_at`, a
30-minute stale purge, broadcast, and `cleanupIfEmpty()` teardown. `wrangler.jsonc` describes the
binding as _"Durable Objects for WebSocket-based real-time features (signaling, chat)"_.

Routing is established at `worker/index.ts:95`:

```ts
if (url.pathname.startsWith('/ws/signaling/')) {
  const roomId = url.pathname.split('/')[3];
  const id = env.SIGNALING_ROOM.idFromName(roomId);
  return env.SIGNALING_ROOM.get(id).fetch(request);
}
```

A chat room DO is a copy of a pattern already running in production in this repo. Two things about
it must **not** be copied — see [persistence](#durable-object-for-fan-out-postgres-for-truth) and
[auth](#do-not-copy-the-signaling-auth-model).

---

## Proposed Design

### Durable Object for fan-out, Postgres for truth

The DO holds a hot buffer in its own SQLite so a joining member gets `room-state` instantly, then
persists through to Postgres via `app/api/internal/*` — the route family `setInternalAuthToken`
(`worker/index.ts`) already exists to serve.

Postgres is authoritative because DO-only history would be invisible to moderation, invisible to
search, and invisible to account-deletion sweeps. That also matches the posture
`docs/RESILIENCE-ROADMAP.md:309` sets for the relay: panamia is the source of truth.

**One deliberate divergence from `SignalingRoom`:** it wipes its tables in `cleanupIfEmpty()` when
the last participant disconnects. Correct for an ephemeral three-person video call, catastrophic for
a chat room. Chat history survives an empty room.

> **Free-plan constraint:** the `wrangler.jsonc` migration entry for the chat DO class must use
> `new_sqlite_classes`, not `new_classes`. The existing `SignalingRoom` migration tag `v1` shows the
> shape.

---

## Schema

Shape only. The `room` reference below is a placeholder for whatever chat ends up scoped to — a
group, a direct-message pair, or a standalone room. That decision is upstream of this table.

```ts
export const chatMessages = pgTable('chat_messages', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  roomId: text('room_id').notNull(),
  actorId: text('actor_id')
    .notNull()
    .references(() => socialActors.id),
  body: text('body').notNull(),
  replyToId: text('reply_to_id').references((): AnyPgColumn => chatMessages.id),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

`deletedAt` is a soft delete. Moderation needs to remove a message from the room without destroying
the evidence of what was removed — and unlike Nostr, where
`components/relay/groups/GroupDetail.tsx:290` has to warn that messages cannot be retracted, a
native store can actually honor a takedown.

---

## Do Not Copy The Signaling Auth Model

> **Warning: this is the one thing most likely to be got wrong by copying the existing DO.**

`/ws/signaling/:roomId` performs **no authentication**. It routes straight through to the DO, and
the DO trusts `data.userId` from the client's own `join` message. For a mentoring proof-of-concept
behind unguessable room IDs that is survivable. For chat it is a hole: anyone could open the socket
and claim to be anyone.

Browsers cannot set headers on a WebSocket, so the check belongs in the Worker — which **can** set
headers on the inner `stub.fetch`:

```ts
if (url.pathname.startsWith('/ws/chat/')) {
  const roomId = url.pathname.split('/')[3];
  const session = await auth(); // cookies ARE sent on same-origin WS upgrade
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const member = await getRoomMembership(roomId, session.user.id);
  if (!member || member.status !== 'active') {
    return new Response('Forbidden', { status: 403 });
  }

  // The client cannot forge these: they are set server-side on the inner fetch.
  const authed = new Request(request);
  authed.headers.set('X-Pana-Actor-Id', member.actorId);
  authed.headers.set('X-Pana-Room-Role', member.role);

  const id = env.CHAT_ROOM.idFromName(roomId);
  return env.CHAT_ROOM.get(id).fetch(authed);
}
```

The DO reads identity from the header and **ignores any identity in the message payload**. Build it
this way in the first commit; retrofitting identity into a live chat protocol means a flag day.

---

## Roadmap

Sequencing depends on the surface decision, so these are ordered rather than numbered against the
groups roadmap.

### Step 1 — Decide the surface

Answer [the scope question](#risks--open-questions) first. Direct messages, group rooms, and
standalone rooms imply different membership sources, and membership is what the auth gate reads.

### Step 2 — Transport

- Chat DO class; binding with `new_sqlite_classes`
- Authenticated `/ws/chat/:roomId` upgrade per the snippet above, **in the first commit**
- Presence, broadcast, and reconnect, modelled on `SignalingRoom` minus the teardown

### Step 3 — Persistence

- `chat_messages` table and the `app/api/internal/*` write path
- Backfill-on-join so a member who was offline gets history from Postgres, not just the DO buffer
- Account-deletion sweep includes chat

### Step 4 — Surface

- The UI, wherever step 1 landed
- Moderation affordances: soft delete, and whatever the room's role model allows

---

## Risks & Open Questions

### What is chat scoped to? — blocks everything else

Direct messages between two panas, rooms attached to groups, standalone rooms, or some combination.
This determines the membership source, the auth gate, the room ID scheme, and the UI surface.
Nothing else in this document can be built until it is answered.

### Member cap per room

`SignalingRoom` caps at `MAX_PARTICIPANTS = 3`. A chat room needs a real number, and the DO
broadcast loop is O(members) per message.

### Other open questions

- **Does chat need federation at all?** Assumed no, per [Non-Goals](#non-goals).
- **Does the Postgres write path need to be synchronous with broadcast,** or can it lag? Lagging is
  cheaper and risks losing the tail of a room's history if a DO evicts mid-write.
- **Do relay groups eventually bind to native chat,** or stay fully separate? Staying separate is
  the assumption throughout. Note that `docs/RESILIENCE-ROADMAP.md:551` already plans a
  Nostr→ActivityPub bridge in the opposite direction, which may make this moot.
