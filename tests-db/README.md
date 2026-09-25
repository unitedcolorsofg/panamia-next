# Database Tests

Tests that exercise `lib/` directly against a real Postgres. No browser, no
HTTP — these call the federation wrappers the same way an API route does, so
they cover the data-layer invariants the Playwright suite cannot reach from
outside.

Kept separate from `tests/` (Playwright, browser) and `tests-relay/`
(raw Nostr WebSocket frames against the relay).

## Running

```
yarn test:db
```

Reads `POSTGRES_URL` from `.env.local` locally. In CI the variable is already
exported and dotenv leaves it alone, so the same command works unchanged.

## What's tested

`group-lifecycle.test.ts` covers `lib/federation/wrappers/group.ts`:

- `createGroup` mints a `Group`-typed actor and seats the founder as admin
- `topics` round-trips as a flag map, `rules` as an ordered array
- handles are unique across the flat screenname namespace
- `getGroupByHandle` withholds `privateKey` and does not nest the group twice
- `joinGroup` is idempotent and keeps `member_count` truthful
- the last active admin cannot leave and strand the group
- a ban blocks both leaving and rejoining
- `request` policy yields a pending row that does not count as membership
- `invite` policy refuses a self-serve join
- deleting a group actor cascades to the group and its members

## Writing more

Fixtures must be namespaced with a per-run random suffix and removed in an
`after` hook. The database these run against is shared and seeded, so a test
that truncates or assumes an empty table will destroy someone's dev data and
race other CI runs.

`scripts/reset-test-db.ts` does truncate everything. It exists for CI's
dedicated database — never couple a suite here to it.

Close the pool in teardown (`db.$client.end()`), or postgres.js keeps the
process alive and the runner hangs.
