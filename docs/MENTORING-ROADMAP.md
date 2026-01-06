# Peer Mentoring Roadmap

## Philosophy & Best Practices

### MENTOR.org E-Mentoring Standards

Pana MIA's peer mentoring feature is informed by MENTOR's _E-Mentoring Supplement to the Elements of Effective Practice for Mentoring™_, which establishes evidence-based standards for technology-enabled mentoring programs.

> "E-mentoring elevates the unique intersection of mentoring and technology by providing mentees and mentors with a diverse field of programs that center availability and accessibility of platforms, eliminate geographic barriers for matches, encourage improvement of social and relationship skills, and offer specialized academic or career related support."
>
> — MENTOR: The National Mentoring Partnership

**Reference:** [E-Mentoring Supplement to the Elements of Effective Practice for Mentoring](https://www.mentoring.org/resource/e-mentoring-supplement-to-the-elements-of-effective-practice-for-mentoring/)

### Elements of Effective Practice

The _Elements of Effective Practice for Mentoring™_ outlines six core standards that Pana MIA's implementation considers:

1. **Recruitment** — How mentors and mentees are attracted to the program
2. **Screening** — Ensuring safety and appropriate matching
3. **Training** — Preparing participants for effective mentoring relationships
4. **Matching & Initiating** — Connecting mentors and mentees thoughtfully
5. **Monitoring & Support** — Ongoing oversight of mentoring relationships
6. **Closure** — Ending relationships appropriately when needed

### Pana MIA's Approach

Pana MIA takes a **community-centered peer mentoring** approach that differs from traditional hierarchical mentoring:

**Peer-to-Peer Model**

- Every user can be both mentor and mentee
- Expertise is distributed across the community
- Relationships are mutual and reciprocal

**Offline Mentoring Sessions**

- Support for in-person meetings alongside video calls
- Community events as mentoring opportunities
- Local connections strengthened through digital discovery

**Accessibility-First Design**

- Mobile-responsive interface
- Multiple session types for different needs
- Free options always available (panamia_planning)

**Community Safety**

- Session requests require mentor confirmation
- Notification system keeps all parties informed
- Cancellation tracking for accountability

## Session Types

Pana MIA differentiates four types of mentoring sessions to serve diverse community needs:

| Type                 | Description                                                             | Pricing          |
| -------------------- | ----------------------------------------------------------------------- | ---------------- |
| `artistic`           | Creative consultation — draft poem critique, art feedback, music review | Mentor sets rate |
| `knowledge_transfer` | Business advice, career guidance, technical skills sharing              | Mentor sets rate |
| `panamia_planning`   | Pana MIA community planning and coordination                            | Always free      |
| `pana_support`       | True peer mentoring — personal support and comradery                    | Mentor sets rate |

### Session Type Philosophy

**Artistic Consultation**
Supports the creative community by connecting artists with peers who can provide constructive feedback on works in progress. This celebrates Pana MIA's roots in creative expression.

**Knowledge Transfer**
Traditional mentoring focused on skill development, career advancement, and professional growth. Mentors share expertise in their fields.

**Pana MIA Planning**
Community organizing sessions are always free to encourage participation in building Pana MIA. Anyone can request time with community leaders to discuss initiatives.

**Pana Support**
The heart of peer mentoring — human connection, emotional support, and solidarity. Not therapy, but the kind of support friends provide each other.

## Notification System

### Session Request Flow

```
Mentee requests session → Session status: 'pending'
                        → Mentor receives notification (Invite)

Mentor accepts         → Session status: 'scheduled'
                        → Mentee receives notification (Accept)
                        → Session URL provided

Mentor declines        → Session status: 'declined'
                        → Mentee receives notification (Reject)
                        → Decline reason included

Either party cancels   → Session status: 'cancelled'
                        → Other party receives notification (Delete)
                        → Cancel reason included
```

### Notification Types

| Event             | ActivityPub Type | Context     |
| ----------------- | ---------------- | ----------- |
| Session requested | `Invite`         | `mentoring` |
| Session accepted  | `Accept`         | `mentoring` |
| Session declined  | `Reject`         | `mentoring` |
| Session cancelled | `Delete`         | `mentoring` |

## Future Enhancements

### Near-Term

- **Google Calendar Integration** — Sync scheduled sessions with external calendars
- **Session Reminders** — Email/notification reminders before scheduled sessions
- **Availability Calendar** — Mentors set available time slots

### Medium-Term

- **TURN Server Configuration** — Improved WebRTC connectivity behind firewalls
- **Session Recording** — Optional recording with consent
- **Screen Sharing** — For technical/visual demonstrations
- **Mentor Badges** — Recognition for active community mentors

### Long-Term

- **Payment Integration** — Stripe checkout for paid sessions
- **Group Sessions** — One-to-many mentoring for workshops
- **Mentor Matching Algorithm** — AI-assisted mentor recommendations
- **Federation** — ActivityPub integration for cross-community mentoring

## API Endpoints

### Sessions

| Endpoint                               | Method | Description            |
| -------------------------------------- | ------ | ---------------------- |
| `/api/mentoring/sessions`              | GET    | List user's sessions   |
| `/api/mentoring/sessions`              | POST   | Request new session    |
| `/api/mentoring/sessions/[id]`         | GET    | Get session details    |
| `/api/mentoring/sessions/[id]`         | PATCH  | Update/cancel session  |
| `/api/mentoring/sessions/[id]/respond` | POST   | Accept/decline request |

### Profiles

| Endpoint                  | Method | Description              |
| ------------------------- | ------ | ------------------------ |
| `/api/mentoring/profile`  | GET    | Get mentoring profile    |
| `/api/mentoring/profile`  | POST   | Update mentoring profile |
| `/api/mentoring/discover` | GET    | Search available mentors |

## References

- [MENTOR: E-Mentoring Supplement](https://www.mentoring.org/resource/e-mentoring-supplement-to-the-elements-of-effective-practice-for-mentoring/)
- [Elements of Effective Practice for Mentoring™](https://www.mentoring.org/resource/elements-of-effective-practice-for-mentoring/)
- [docs/MENTORING.md](./MENTORING.md) — User guide and developer documentation
