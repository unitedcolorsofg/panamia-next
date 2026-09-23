# Design Mocks (`/mock/*`)

Static, hardcoded design mocks used to agree on a surface before it is built
against real data. Nothing here queries the database, and every route is
`noindex` so the mocks never reach search results.

These are not prototypes to be shipped as-is. They are the argument for a
design, written in the real design system so the argument is honest: if a
layout only works with invented spacing or colours that are not in
`app/globals.css`, that shows up here rather than in review.

| Route             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `/mock/home`      | Homepage cut to four cards, built from the Connectors deck |
| `/mock/profile`   | Personal profile page (pana page) redesign                 |
| `/mock/feed`      | Pana Social feed redesign, including the empty feed        |
| `/mock/panaverse` | Panaverse chrome: masthead, surface switcher, identity     |
| `/mock/settings`  | Account settings — one page, either masthead               |

## Viewing the Pana Social surface

`/mock/feed` mocks a page of `social.panamia.club`, not a page of
`panamia.club`. The root layout picks its chrome from the request hostname via
`resolveSurface`, so the hostname you use decides what you see:

```
http://localhost:3002/mock/feed          → Pana Mia masthead wraps the mock
http://social.localhost:3002/mock/feed   → Pana Social, standalone
```

Use the second one when reviewing the feed. Browsers route `*.localhost` to
the loopback address with no hosts-file entry, and `resolveSurface` maps
`social.localhost` exactly the way it maps `social.panamia.club`, so this
exercises the real production rule rather than a preview-only shortcut.

## Conventions

- **`_data/`** holds all fixtures and their types. Fields are annotated with
  the real column they stand in for (`socialStatuses.content`,
  `profiles.primaryImageCdn`, and so on) so swapping to live data is
  mechanical rather than interpretive.
- **`_components/`** holds the mock's components. Leading `_` keeps both
  folders out of the router.
- **`app/mock/_data/` and `app/mock/_components/`** hold the pieces more than
  one mock needs — the surface registry fixtures, the masthead, the surface
  switcher, the browser frame. A mock-specific folder stays inside that mock;
  it only moves up when a second mock imports it.
- **Shared primitives** live in `app/globals.css` and are deliberately reused
  across mocks. A post card looks the same on the profile and in the feed
  because it is literally the same `.profile-card`.
- **Derived numbers are computed, never typed.** Tab counts come from the same
  function that returns the rendered list, so a mock cannot advertise a number
  it does not render.
- Each mock ends with a footer note naming its own route, so a screenshot
  taken out of context still says where it came from.

## Legal terms

`app/mock` is classified `exempt` in `app/legal/terms/namespaces.json`: the
mocks collect nothing, store nothing, and are not a user-facing feature.
