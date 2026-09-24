# Database Predicate Tests

Query-level tests that run against a real Postgres without needing one
provisioned. `@electric-sql/pglite` is Postgres compiled to WASM, so the
database is created in-process and thrown away when the run ends — no service
container, no connection string, no shared state between runs.

Kept separate from the Playwright suite (`tests/`), which drives a browser
against a deployed app and a shared Supabase project.

## Running

```
yarn test:db
```

## What's tested

`visibility.test.ts` covers `lib/federation/wrappers/visibility.ts`, the
predicate deciding who may read a status.

This matters more than a typical unit test. Direct messages, followers-only
posts and public posts are all rows in `social_statuses`, separated only by
their ActivityPub addressing. Three read paths once queried that table without
testing the addressing, and because two of them required no authentication,
any member's DMs were readable by an anonymous caller who knew a username.

The suite asserts the full addressing matrix:

| viewer               | public | unlisted | followers-only | DM to someone else |
| -------------------- | ------ | -------- | -------------- | ------------------ |
| anonymous            | yes    | yes      | no             | no                 |
| signed-in stranger   | yes    | yes      | no             | no                 |
| pending follower     | yes    | yes      | no             | no                 |
| accepted follower    | yes    | yes      | yes            | no                 |
| the recipient        | yes    | yes      | no             | yes (addressed)    |
| the author           | yes    | yes      | yes            | yes                |

The follower row is the one to preserve: following someone grants their
followers-only posts and nothing else. Expiry is covered too, so a DM past
`expires_at` stops being served.

## Adding tests

Import the predicate and render it with Drizzle's own dialect rather than
restating its SQL:

```ts
const { sql, params } = new PgDialect().sqlToQuery(visibleTo('actor_id'));
await db.query(`SELECT id FROM social_statuses WHERE ${sql}`, params);
```

That keeps the test pointed at the SQL that actually ships. A predicate
rewritten by hand in the test file would keep passing after the real one
regressed, which for this particular predicate means silently re-exposing
private posts.

The `before` hook creates only the columns the predicate touches. If a column
is renamed in `lib/schema`, the rendered SQL stops matching these fixtures and
the suite fails — update the DDL here to match.
