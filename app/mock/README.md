# Design Mocks (`/mock/*`)

Static, hardcoded design mocks used to agree on a surface before it is built
against real data. Nothing here queries the database, and every route is
`noindex` so the mocks never reach search results.

These are not prototypes to be shipped as-is. They are the argument for a
design, written in the real design system so the argument is honest: if a
layout only works with invented spacing or colours that are not in
`app/globals.css`, that shows up here rather than in review.

| Route             | Description                                            |
| ----------------- | ------------------------------------------------------ |
| `/mock/profile`   | Personal profile page (pana page) redesign             |
| `/mock/feed`      | Pana Social feed redesign, including the empty feed    |
| `/mock/panaverse` | Panaverse chrome: masthead, surface switcher, identity |

## Conventions

- **`_data/`** holds all fixtures and their types. Fields are annotated with
  the real column they stand in for (`socialStatuses.content`,
  `profiles.primaryImageCdn`, and so on) so swapping to live data is
  mechanical rather than interpretive.
- **`_components/`** holds the mock's components. Leading `_` keeps both
  folders out of the router.
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
