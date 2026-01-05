# App Directory

Next.js 14+ App Router directory containing all pages, layouts, and API routes.

## Page Routes

### Public Pages

| Route               | Description                                  |
| ------------------- | -------------------------------------------- |
| `/`                 | Homepage with featured profiles and articles |
| `/about-us`         | About Pana MIA page                          |
| `/directory`        | Browse business directory                    |
| `/directory/search` | Search directory with filters                |
| `/directorio`       | Spanish alias for directory                  |
| `/articles`         | Browse community articles                    |
| `/articles/[slug]`  | View single article                          |
| `/articles/new`     | Create new article (auth required)           |
| `/profile/[handle]` | Public profile view                          |
| `/list/[id]`        | View a curated list                          |
| `/signin`           | Authentication page                          |
| `/links`            | Link tree style page                         |
| `/podcasts`         | Podcast listings                             |
| `/donate`           | Donation page                                |

### Account Pages (`/account/*`)

Authenticated user pages for managing their own content:

| Route                          | Description                            |
| ------------------------------ | -------------------------------------- |
| `/account/user/edit`           | Edit user settings (email, screenname) |
| `/account/user/following`      | Manage followed profiles               |
| `/account/user/lists`          | Manage personal lists                  |
| `/account/profile`             | Profile dashboard                      |
| `/account/profile/edit`        | Edit profile basics                    |
| `/account/profile/desc`        | Edit profile description               |
| `/account/profile/address`     | Edit location/address                  |
| `/account/profile/contact`     | Edit contact info                      |
| `/account/profile/social`      | Edit social links                      |
| `/account/profile/categories`  | Edit business categories               |
| `/account/profile/images`      | Manage profile images                  |
| `/account/profile/gentedepana` | Gente de Pana settings                 |
| `/account/articles`            | Manage your articles                   |
| `/account/notifications`       | View notifications                     |
| `/account/admin/*`             | Admin panel (admin users only)         |

### Admin Pages (`/admin/*`)

Site administration (requires admin role):

| Route                      | Description                |
| -------------------------- | -------------------------- |
| `/admin/profile`           | Admin profile management   |
| `/admin/profile/action`    | Profile moderation actions |
| `/admin/download-profiles` | Export profile data        |
| `/account/admin/users`     | User management            |
| `/account/admin/articles`  | Article moderation         |
| `/account/admin/contactus` | Contact form submissions   |
| `/account/admin/signups`   | Signup requests            |
| `/account/admin/mentoring` | Mentoring program admin    |
| `/account/admin/podcasts`  | Podcast management         |
| `/account/admin/import`    | Import profiles            |

### Mentoring (`/mentoring/*`)

Mentorship program pages:

| Route                      | Description                |
| -------------------------- | -------------------------- |
| `/mentoring/discover`      | Find mentors               |
| `/mentoring/profile`       | Your mentor/mentee profile |
| `/mentoring/profile/edit`  | Edit mentoring profile     |
| `/mentoring/schedule`      | View/manage schedule       |
| `/mentoring/schedule/book` | Book a session             |
| `/mentoring/session/[id]`  | View session details       |

### Forms (`/form/*`)

Public submission forms:

| Route                        | Description           |
| ---------------------------- | --------------------- |
| `/form/contact-us`           | Contact form          |
| `/form/become-a-pana`        | Profile signup form   |
| `/form/become-a-pana-single` | Simplified signup     |
| `/form/become-an-affiliate`  | Affiliate application |
| `/form/join-the-team`        | Team application      |

### Feeds (`/feed*`)

RSS and JSON feeds for articles:

| Route                       | Description                 |
| --------------------------- | --------------------------- |
| `/feed.xml`                 | RSS 2.0 feed (all articles) |
| `/feed.json`                | JSON Feed format            |
| `/feed/author/[screenname]` | Articles by author          |
| `/feed/tag/[tag]`           | Articles by tag             |
| `/feed/type/[type]`         | Articles by type            |

### Other Pages

| Route                                 | Description              |
| ------------------------------------- | ------------------------ |
| `/affiliate`                          | Affiliate portal         |
| `/donation/confirmation`              | Post-donation page       |
| `/event/panimo-by-pana-mia`           | Event page               |
| `/doc/terms-and-conditions`           | Terms of service         |
| `/doc/affiliate-terms-and-conditions` | Affiliate terms          |
| `/become-a-pana`                      | Signup landing page      |
| `/become-a-pana-google`               | Google-specific signup   |
| `/migrate-email`                      | Email migration flow     |
| `/verify-oauth-email`                 | OAuth email verification |
| `/test`                               | Development test page    |

## API Routes

See [app/api/README.md](./api/README.md) for comprehensive API documentation.

## File Conventions

| File            | Purpose                             |
| --------------- | ----------------------------------- |
| `page.tsx`      | Main component rendered for route   |
| `layout.tsx`    | Shared layout wrapping child routes |
| `loading.tsx`   | Loading UI while route loads        |
| `error.tsx`     | Error boundary for route            |
| `route.ts`      | API route handler                   |
| `not-found.tsx` | Custom 404 page                     |

## Dynamic Route Patterns

| Pattern      | Usage                                    |
| ------------ | ---------------------------------------- |
| `[slug]`     | URL-safe identifier (articles, profiles) |
| `[id]`       | MongoDB ObjectId                         |
| `[handle]`   | User profile handle                      |
| `[...param]` | Catch-all routes                         |

## See Also

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [API Documentation](./api/README.md)
- [Article Roadmap](/docs/ARTICLE-ROADMAP.md)
- [Mentoring Roadmap](/docs/MENTORING-ROADMAP.md)
