# Chat — Design & Roadmap

> **STATUS**: **Proposal. Nothing here is implemented.** No migration, table, route, Durable Object,
> or component described below exists yet.
>
> **Direct messages are no longer a candidate surface.** DMs ship as _mail_ on the existing
> `visibility: 'direct'` status substrate, decided against the side-by-side mock at `/mock/dms`.
> See `docs/SOCIAL-GRAPH.md` §C1. What is still undecided is whether chat hangs off groups or
> standalone rooms. See [Open Questions](#risks--open-questions).
>
> **New input (2026-10): panas have asked for realtime.** That is a direct hit on the one cost the
> `/mock/dms` comparison recorded against the mail model — _"no realtime; a reply appears on refresh
> or poll."_ It does **not** reopen the mail-vs-chat decision, because the thing being asked for is
> separable from the thing that was decided. See
> [Realtime delivery is not realtime affordances](#realtime-delivery-is-not-realtime-affordances)
> and [Path A](#path-a--live-delivery-on-the-mail-substrate).
>
> This material was extracted from `docs/GROUPS-ROADMAP.md`, where it was originally phase 5. Groups
> ship without it. The two features share a membership model if and only if chat ends up scoped to
> groups, which is itself an open question.

## Table of Contents

- [Overview](#overview)
- [Realtime delivery is not realtime affordances](#realtime-delivery-is-not-realtime-affordances)
- [Path A — live delivery on the mail substrate](#path-a--live-delivery-on-the-mail-substrate)
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

## Realtime delivery is not realtime affordances

The `/mock/dms` comparison asked one binary question — mail **or** chat — and every argument in this
document inherits that framing. The panas asking for realtime have exposed it as a false binary,
because "realtime" names two separable things and the comparison only ever priced them together.

|                          | What it is                                        | What it costs                                         |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------- |
| **Realtime delivery**    | A message you were sent appears without a refresh | A socket. No schema change, no second store           |
| **Realtime affordances** | Presence dots, typing indicators, read receipts   | A second store, or liveness the network cannot supply |

**The anti-realtime argument in this document is entirely an argument against the second column.**
Reread it:

> Real-time affordances **advertise liveness**: on a network of a few hundred locals, a presence dot
> that always reads "offline" and a typing indicator that never fires make a room look abandoned.

Every noun there is an affordance. None of it is delivery. A message arriving the moment it is sent
advertises nothing and can never read as abandoned — it is invisible until there is something to
show, and when there is, it is strictly better than the member discovering it on next refresh.

**Mail's recorded cost was delivery, not affordances.** The mock listed exactly one serious cost
against the model we chose — _"No realtime. A reply appears on refresh or poll."_ That is column
one. It was priced as though buying it meant buying the chat model, and it does not.

**And the chat model's costs are all substrate costs, which delivery does not incur.** The mock's
own list:

- _"Does not federate."_
- _"Two parallel DM systems unless the direct-status path is retired, and voice memos live on that
  path."_
- _"Block, mute, and report all need re-implementing against a second store."_
- _"Moderation gets harder: a transcript is not a status, so nothing we built applies."_

Every one of those is caused by `chat_messages` being a new table, not by the socket. Adding a
socket in front of `socialStatuses` pays none of them: federation still works because the message is
still a status, block filtering still applies because it is the same read path, moderation still
applies because it is the same row, and voice memos keep working because nothing moved.

**Conclusion: buy column one, decline column two.** That deletes the only cost recorded against the
model we chose, costs nothing the mock warned about, and leaves the mail-vs-chat decision standing.

---

## Path A — live delivery on the mail substrate

Scope: a DM that has been sent appears in an open thread without a refresh. Nothing else.

**Explicitly out of scope:** presence, typing indicators, and read receipts — the affordances the
liveness argument above rules out. They stay out until a surface exists where liveness is real,
which is the group-room case this document was originally written for.

### Shape

One Durable Object **per recipient actor**, not per thread. A thread DO would need the member to
have the thread open to receive anything, which is the one case where they do not need the socket.
An actor-scoped DO is a mailbox: the member holds one connection, and anything addressed to them
arrives on it regardless of which thread is on screen — which is also what makes an unread badge
live, for free.

```
POST /api/social/statuses (visibility: 'direct')
  └─ createStatus() writes the row            ← Postgres stays authoritative
       └─ for each recipient actor:
            env.DM_STREAM.idFromName(actorId) → stub.fetch('/notify')
                 └─ broadcast to that actor's open sockets (if any)
```

The DO stores **nothing**. It is a fan-out point, not a cache — which is the significant divergence
from both `SignalingRoom` and the chat design below, and it is what keeps this path free of the
second-store costs listed above. If the member is offline the notify is a no-op and they read the
message from Postgres on next load, exactly as they do today. Delivery is therefore best-effort by
construction, and the existing read path is the fallback rather than a recovery mechanism that has
to be written.

### Auth

Identical to the rule in [Do Not Copy The Signaling Auth Model](#do-not-copy-the-signaling-auth-model),
and non-negotiable for the same reason. `/ws/dm` resolves the session in the Worker, derives the
actor ID server-side, and routes to that actor's DO. The client never names the mailbox it is
connecting to — if it could, it could read anyone's.

### Steps

1. `DmStream` DO class; binding with `new_sqlite_classes` (free-plan requirement, same as
   `SignalingRoom`'s `v1` tag), plus a `migrations` entry.
2. Authenticated `/ws/dm` upgrade in `worker/index.ts`, alongside the existing
   `/ws/signaling/` branch. Session → actor ID → `idFromName(actorId)`. **In the first commit.**
3. Notify-on-send from the direct branch of `createStatus` in `lib/federation/wrappers/status.ts`.
   Best-effort and non-blocking: a failed notify must never fail the send, because the message is
   already durably in Postgres and the read path will find it.
4. Client hook that opens the socket and invalidates the thread query on message. Reconnect with
   backoff; on reconnect, refetch rather than replay — Postgres is the truth and the DO holds no
   history to replay from.

### Prerequisite — the thread view has to exist first

**There is no DM conversation UI in this repo today.** What ships is the substrate (direct statuses,
`recipientTo`, `inReplyToId`), the gating from `0051_social_dm_requests`, the held-request review in
`/updates`, and two list routes under `app/api/social/messages/`. Voice memos send as direct
statuses. None of that is a thread you can sit in and watch.

So Path A is ordered **after** the mail thread view, not before it: a socket whose only job is to
make an open thread update live has nothing to update until there is an open thread. Building the
transport first would mean shipping a DO whose sole consumer is `/mock/dms`, which is the same
mistake as building rooms before deciding their scope.

The sequencing is therefore: mail thread view → Path A → (group rooms, once scoped).

### Why the surface decision does not block this

[Step 1](#step-1--decide-the-surface) blocks the chat design because membership is what the auth
gate reads, and rooms have no membership until they have a scope. Path A has no rooms: the mailbox
is the actor, and the actor exists. The prerequisite above is a different and much smaller
constraint — it orders this after one UI, not after an unmade product decision.

It is also additive. If group chat later lands on its own DO, nothing here is thrown away or
migrated, because this one never owned any data.

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

> [Path A](#path-a--live-delivery-on-the-mail-substrate) is not in this sequence. It is independent
> of the surface decision and carries its own steps and its own prerequisite — the mail thread view.
> The steps below are the **group/standalone room** build, which is what remains blocked.

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

**Half answered: not direct messages.** DMs ship as mail on the existing direct-status substrate,
so chat does not inherit them. What remains is rooms attached to groups, standalone rooms, or both
— which still determines the membership source, the auth gate, the room ID scheme, and the UI
surface. Nothing else in this document can be built until that half is answered —
**except [Path A](#path-a--live-delivery-on-the-mail-substrate), which has no rooms and is
therefore not blocked by it.**

The reasoning that settled the DM half is worth keeping, because it applies to group rooms too.
Real-time affordances **advertise liveness**: on a network of a few hundred locals, a presence dot
that always reads "offline" and a typing indicator that never fires make a room look abandoned,
where an async thread with three messages in it reads as perfectly healthy. Chat earns its
infrastructure where people are already talking — a group with a shared purpose — not in a cold
two-person thread, which is the case this document originally assumed.

**Note the scope of that argument, which an earlier draft of this section overstated.** It rules out
*affordances* in a cold thread. It does not rule out *delivery*, and the mock's cost list against
the mail model was delivery — see
[Realtime delivery is not realtime affordances](#realtime-delivery-is-not-realtime-affordances).
Reading this paragraph as "no sockets near DMs" is the misreading to avoid.

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
