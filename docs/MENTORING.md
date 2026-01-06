# Pana Mia Club - Mentoring Feature Guide

> ⚠️ **PROTOTYPE STATUS**: The peer-to-peer video mentoring feature using WebRTC is currently in **prototype/experimental stage**. While functional for testing and development, it may not work in all network configurations (especially behind strict firewalls or NATs) and is not yet production-ready. TURN server configuration is planned for future releases to improve connectivity.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [User Guide](#user-guide)
  - [Setting Up Your Mentoring Profile](#setting-up-your-mentoring-profile)
  - [Finding Mentors](#finding-mentors)
  - [Booking a Session](#booking-a-session)
  - [Joining a Video Session](#joining-a-video-session)
  - [Managing Your Sessions](#managing-your-sessions)
- [Developer Guide](#developer-guide)
  - [Architecture Overview](#architecture-overview)
  - [Configuration](#configuration)
  - [Extending the Feature](#extending-the-feature)
  - [Troubleshooting](#troubleshooting)
- [Technical Reference](#technical-reference)

---

## Overview

The Pana Mia Club mentoring feature enables **peer-to-peer video mentoring** within the community. Every user can act as both a **mentor** and a **mentee**, facilitating knowledge sharing and professional growth.

### Key Features

**Profile Management**: Create and customize your mentoring profile
**Mentor Discovery**: Search and filter mentors by expertise and language
**Session Types**: Four distinct session types (artistic, knowledge transfer, pana planning, pana support)
**Session Booking**: Schedule sessions with a calendar interface
**Mentor Confirmation**: Sessions require mentor approval before scheduling
**Notifications**: Real-time notifications for session requests, confirmations, and cancellations
**WebRTC Video**: High-quality peer-to-peer video calls
**Real-time Chat**: Text messaging during sessions
**Collaborative Notes**: Shared note-taking with auto-save
**Session History**: Track past and upcoming sessions

### Technology Highlights

- **WebRTC** (Prototype): Direct peer-to-peer connections for video/audio
- **Pusher**: Real-time signaling and chat infrastructure
- **NextAuth v5**: Secure authentication
- **MongoDB**: Scalable data storage
- **shadcn/ui**: Modern, accessible UI components

### Current Limitations

As this is a prototype implementation:

- **Network restrictions**: May not work behind strict firewalls or symmetric NATs
- **No TURN servers**: Relies on STUN only, limiting connectivity success rate
- **Browser compatibility**: Requires modern browsers with WebRTC support
- **Connection reliability**: P2P connections may fail in certain network configurations

For production use, TURN server configuration and additional fallback mechanisms are recommended.

---

## Getting Started

### Prerequisites

1. **Account**: Sign in to Pana Mia Club with your email
2. **Browser**: Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)
3. **Permissions**: Camera and microphone access for video sessions
4. **Connection**: Stable internet connection (recommended: 5 Mbps+)

### Quick Start

1. Navigate to **Mentoring** → **Profile**
2. Enable your mentoring profile
3. Add your expertise and languages
4. Browse **Discover** to find mentors
5. Book your first session!

---

## User Guide

### Setting Up Your Mentoring Profile

#### Step 1: Access Profile Settings

Navigate to: **Mentoring** → **Mentoring Profile** → **Edit Profile**

#### Step 2: Enable Mentoring

Check the "Enable mentoring profile" box to make yourself discoverable as a mentor.

#### Step 3: Fill Out Your Profile

**Mentoring Bio** (Required, 10-500 characters)

- Describe your mentoring approach
- Highlight what you can help with
- Be authentic and encouraging

Example:

```
I'm a senior software engineer with 10 years of experience in web development.
I love helping others learn JavaScript, React, and career navigation. My
mentoring style is collaborative and encouraging—we'll work through challenges
together!
```

**Areas of Expertise** (Required, 1-10 tags)

- Add specific skills or topics
- Use clear, searchable terms
- Examples: "JavaScript", "Career Advice", "React", "System Design"

**Languages** (Required, 1+ languages)

- Specify languages you can mentor in
- Examples: "English", "Spanish", "French"

**Video Introduction URL** (Optional)

- Link to a short introduction video
- Helps potential mentees get to know you
- Host on YouTube, Vimeo, or similar platforms

**Mentoring Goals** (Optional)

- Share what you hope to achieve through mentoring
- Helps align expectations

**Hourly Rate** (Optional, $0+ USD)

- Set to $0 for free mentoring
- Otherwise, specify your rate
- Note: Payment integration not yet implemented

#### Step 4: Save Your Profile

Click **Save Profile** to update your information.

### Finding Mentors

#### Navigate to Discovery

Go to: **Mentoring** → **Discover**

#### Filter Mentors

Use the search filters to find the right mentor:

- **Expertise**: Search for specific skills (e.g., "JavaScript")
- **Language**: Filter by language (e.g., "Spanish")
- **Free Only**: Show only mentors offering free sessions

#### Review Mentor Profiles

Each mentor card shows:

- Name and profile picture
- Mentoring bio
- Areas of expertise (tags)
- Languages spoken
- Hourly rate

#### Book a Session

Click **Book Session** on a mentor's card to proceed to booking.

### Booking a Session

#### Step 1: Choose Session Type

Select the type of session:

- **Artistic Consultation** — Creative feedback on poems, art, music, writing
- **Knowledge Transfer** — Business advice, career guidance, technical skills
- **Pana MIA Planning** — Community planning and coordination (always free)
- **Pana Support** — Peer support, personal guidance, and comradery

#### Step 2: Calendar Selection

- Select a date from the calendar
- Past dates are disabled
- Click on your preferred date

#### Step 3: Choose a Time Slot

- Time slots available: 9 AM - 5 PM (30-minute intervals)
- Click on a time slot to select it
- Selected time highlights in blue

#### Step 4: Set Duration

Choose session duration:

- 15 minutes (quick chat)
- 30 minutes (focused discussion)
- 60 minutes (standard session)
- 90 minutes (deep dive)
- 120 minutes (extended session)

#### Step 5: Describe the Topic

Enter what you'd like to discuss (5-200 characters).

Example:

```
I'd like to learn about React hooks and best practices for state management
in complex applications.
```

#### Step 6: Submit Request

Click **Request Session** to send your request. The mentor will receive a notification.

**Note:** Sessions require mentor confirmation. Your session will show as "Pending" until the mentor accepts.

### Session Confirmation

#### For Mentees

After requesting a session:

1. The session appears in your dashboard as "Pending"
2. You'll receive a notification when the mentor responds
3. If **accepted**: Status changes to "Scheduled" and you can join at the scheduled time
4. If **declined**: You'll see the reason and can request a different time

#### For Mentors

When someone requests a session with you:

1. You'll receive a notification with session details
2. Go to **Mentoring** → **My Sessions** to see pending requests
3. Review the topic and time, then click **Accept** or **Decline**
4. If declining, provide a reason (helps the mentee understand)

### Joining a Video Session

#### Step 1: Find Your Session

Go to: **Mentoring** → **My Sessions**

Upcoming sessions appear in the "Upcoming Sessions" section.

#### Step 2: Join the Session

Click **Join Session** to enter the video room.

**Browser will request permissions:**

- Camera access
- Microphone access

Click "Allow" to grant permissions.

#### Step 3: Wait for Connection

- Your video appears in the bottom-right corner
- The other participant's video appears in the main area
- "Connecting..." indicator shows while establishing connection
- Connection typically takes 3-10 seconds

#### Step 4: Use Video Controls

**Mute/Unmute Button**

- Toggles your microphone on/off
- Red when muted, blue when active

**Video On/Off Button**

- Toggles your camera on/off
- Red when off, blue when active

**End Call Button**

- Terminates the session
- Returns you to sessions dashboard

#### Step 5: Use Chat

**Right sidebar - Chat panel:**

- Type messages in the input field
- Press Enter or click Send
- Messages appear in real-time for both participants
- Your messages appear in blue, others in gray

#### Step 6: Take Notes

**Right sidebar - Session Notes panel:**

- Type notes in the textarea
- Notes auto-save after 1 second of inactivity
- "Saving..." indicator shows during save
- Both participants can edit notes
- Notes persist after session ends

#### Step 7: End the Session

Click **End Call** when finished. Your video and audio streams will stop, and you'll return to the dashboard.

### Managing Your Sessions

#### View Sessions Dashboard

Navigate to: **Mentoring** → **My Sessions**

#### Upcoming Sessions

Shows sessions that haven't occurred yet:

- Date and time
- Duration
- Topic
- Other participant (mentor or mentee)
- **Join Session** button (active when session time approaches)
- **Cancel** button

#### Past Sessions

Shows completed or cancelled sessions:

- Session details
- Status badge (completed/cancelled)
- Session notes (if any)
- Cancellation reason (if applicable)
- **View Session Details** button (for completed sessions)

#### Cancelling a Session

1. Find the session in "Upcoming Sessions"
2. Click **Cancel**
3. Provide a reason for cancellation
4. Confirm cancellation

The other participant will see the cancellation with your reason.

---

## Developer Guide

### Architecture Overview

The mentoring feature uses a hybrid architecture:

**Frontend:**

- Next.js 15 App Router (`app/(mentoring)/`)
- React 19 Server and Client Components
- shadcn/ui for UI components
- React Hook Form + Zod for forms

**Backend:**

- Next.js API Routes (`app/api/mentoring/`, `app/api/pusher/`)
- MongoDB with Mongoose for data persistence
- NextAuth v5 for authentication
- Pusher for real-time communication

**Real-time:**

- Pusher for WebRTC signaling (offer/answer/ICE)
- Pusher presence channels for chat
- Native WebRTC APIs for video/audio streams

### Configuration

#### Required Environment Variables

Create or update `.env.local`:

```env
# Pusher Configuration
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_public_key
PUSHER_SECRET=your_secret_key
PUSHER_CLUSTER=your_cluster    # e.g., us2, eu, ap1

# Public (exposed to client)
NEXT_PUBLIC_PUSHER_KEY=your_public_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster

# MongoDB
MONGODB_URI=mongodb://localhost:27017/panamia_dev
# OR MongoDB Atlas:
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/panamia

# NextAuth
NEXTAUTH_SECRET=your_32_char_random_string
NEXTAUTH_URL=https://localhost:3000
```

#### Pusher App Configuration

In your Pusher dashboard, ensure:

1. **Client Events**: Enabled (required for WebRTC signaling)
2. **Private Channels**: Enabled
3. **Presence Channels**: Enabled
4. **Webhook** (optional): Configure for session lifecycle events

#### MongoDB Indexes

Run these commands in MongoDB shell or Compass:

```javascript
// MentorSession collection
db.mentorSession.createIndex({ mentorEmail: 1, scheduledAt: -1 });
db.mentorSession.createIndex({ menteeEmail: 1, scheduledAt: -1 });
db.mentorSession.createIndex({ sessionId: 1 }, { unique: true });

// Profile collection
db.profile.createIndex({ 'mentoring.enabled': 1 });
db.profile.createIndex({ 'mentoring.expertise': 1 });
```

### Extending the Feature

#### Adding a New Field to Profile

**1. Update Mongoose Schema** (`lib/model/profile.ts`):

```typescript
mentoring: {
  // ... existing fields
  newField: String,
}
```

**2. Update Zod Schema** (`lib/validations/mentoring-profile.ts`):

```typescript
export const mentoringProfileSchema = z.object({
  // ... existing fields
  newField: z.string().optional(),
});
```

**3. Update Form** (`app/(mentoring)/profile/edit/_components/profile-form.tsx`):

```typescript
<Input
  {...register('newField')}
  placeholder="Enter new field"
/>
```

**4. Update Profile View** (`app/(mentoring)/profile/page.tsx`):

```typescript
{profile.mentoring.newField && (
  <div className="bg-white p-6 rounded-lg border">
    <h2 className="text-xl font-semibold mb-4">New Field</h2>
    <p>{profile.mentoring.newField}</p>
  </div>
)}
```

#### Adding a Custom Video Control

**1. Add State** (`app/(mentoring)/session/[sessionId]/_components/video-room.tsx`):

```typescript
const [customFeature, setCustomFeature] = useState(false);
```

**2. Add Handler Function**:

```typescript
const toggleCustomFeature = () => {
  // Your logic here
  setCustomFeature(!customFeature);
};
```

**3. Add Button to UI**:

```typescript
<Button onClick={toggleCustomFeature}>
  Custom Feature
</Button>
```

#### Implementing Profile Update API

Currently, the profile form has a placeholder API call. To implement:

**Create API Route** (`app/api/mentoring/profile/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import Profile from '@/lib/model/profile';
import { mentoringProfileSchema } from '@/lib/validations/mentoring-profile';

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();

  const body = await request.json();
  const validation = mentoringProfileSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error },
      { status: 400 }
    );
  }

  const updated = await Profile.findOneAndUpdate(
    { email: session.user.email },
    { mentoring: validation.data },
    { new: true, upsert: false }
  );

  if (!updated) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ profile: updated });
}
```

**Update Form** (`app/(mentoring)/profile/edit/_components/profile-form.tsx`):

```typescript
const onSubmit = async (data: MentoringProfileData) => {
  try {
    const response = await fetch('/api/mentoring/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, expertise, languages }),
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    router.push('/mentoring/profile');
    router.refresh();
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('Failed to update profile');
  }
};
```

### Troubleshooting

#### Video Session Issues

**Problem**: Camera/microphone not working

- **Solution**: Check browser permissions in settings
- **Chrome**: chrome://settings/content/camera
- **Firefox**: about:preferences#privacy → Permissions

**Problem**: "Connecting..." never completes

- **Cause**: Firewall or NAT issues preventing P2P connection
- **Solution**: TURN servers needed (future enhancement)
- **Workaround**: Try different network (mobile hotspot)

**Problem**: Poor video quality

- **Cause**: Low bandwidth
- **Solution**: Turn off camera, use audio only
- **Check**: Run speed test (need 5+ Mbps)

#### Pusher Issues

**Problem**: Chat messages not sending

- **Check**: NEXT_PUBLIC_PUSHER_KEY is set correctly
- **Check**: Pusher app has client events enabled
- **Check**: Browser console for Pusher errors

**Problem**: "Access denied" when joining session

- **Cause**: Not a session participant
- **Check**: Verify you're mentor or mentee for this session
- **Check**: Session ID is correct

#### Database Issues

**Problem**: Sessions not appearing in dashboard

- **Check**: MongoDB connection string is correct
- **Check**: User is authenticated
- **Run**: Check MongoDB logs for errors

**Problem**: Profile not saving

- **Cause**: Validation errors or database connection
- **Check**: Browser console for validation errors
- **Check**: MongoDB is running and accessible

#### Build/Development Issues

**Problem**: Module not found errors

- **Solution**: `npm install`
- **Solution**: Delete `.next` folder and rebuild

**Problem**: TypeScript errors

- **Solution**: Verify all types are imported
- **Solution**: `npx tsc --noEmit` to check types

---

## Technical Reference

### File Structure

```
app/(mentoring)/
├── layout.tsx                          # Protected layout with nav
├── discover/
│   ├── page.tsx                        # Mentor discovery page
│   └── _components/
│       ├── filters.tsx                 # Search filters
│       └── mentor-card.tsx             # Mentor display card
├── profile/
│   ├── page.tsx                        # Profile view
│   └── edit/
│       ├── page.tsx                    # Profile edit page
│       └── _components/
│           └── profile-form.tsx        # React Hook Form
├── schedule/
│   ├── page.tsx                        # Sessions dashboard
│   ├── _components/
│   │   └── sessions-list.tsx           # Session cards
│   └── book/
│       ├── page.tsx                    # Booking page
│       └── _components/
│           └── booking-form.tsx        # Booking form
└── session/
    └── [sessionId]/
        ├── page.tsx                    # Session page (SSR)
        └── _components/
            ├── video-room.tsx          # WebRTC component
            ├── chat-panel.tsx          # Real-time chat
            └── notes-panel.tsx         # Collaborative notes

app/api/mentoring/
├── discover/
│   └── route.ts                        # GET: Search mentors
├── sessions/
│   ├── route.ts                        # GET/POST: List/Create sessions
│   └── [sessionId]/
│       └── route.ts                    # GET/PATCH: Get/Update session

app/api/pusher/
└── auth/
    └── route.ts                        # POST: Authorize Pusher channels

lib/
├── pusher-server.ts                    # Pusher server SDK
├── pusher-client.ts                    # Pusher client SDK
├── model/
│   ├── profile.ts                      # Profile schema (extended)
│   └── mentorSession.ts                # Session schema
└── validations/
    ├── mentoring-profile.ts            # Profile validation
    └── session.ts                      # Session validation

hooks/
└── use-debounce.ts                     # Debounce hook for auto-save
```

### API Reference

See inline JSDoc comments in API route files for detailed parameter documentation.

#### GET `/api/mentoring/sessions`

Query Parameters:

- `role`: 'mentor' | 'mentee' | 'all'
- `status`: 'scheduled' | 'completed' | 'all'

#### POST `/api/mentoring/sessions`

Request Body:

```typescript
{
  mentorEmail: string
  scheduledAt: string (ISO 8601)
  duration: number (15-120)
  topic: string (5-200 chars)
}
```

#### PATCH `/api/mentoring/sessions/[sessionId]`

Request Body:

```typescript
// Update notes
{
  action: 'update_notes';
  sessionId: string;
  notes: string;
}

// Cancel session
{
  action: 'cancel';
  sessionId: string;
  reason: string;
}
```

### Pusher Events

**Channel**: `private-session-{sessionId}`

- `client-offer`: WebRTC offer
- `client-answer`: WebRTC answer
- `client-ice-candidate`: ICE candidate

**Channel**: `presence-session-{sessionId}`

- `client-chat-message`: Chat message

---

## Support & Contribution

### Getting Help

- **Issues**: Open an issue on GitHub
- **Questions**: Ask in community Discord/Slack
- **Security**: Report vulnerabilities privately (see SECURITY_AUDIT.md)

### Contributing

Contributions welcome! Areas for improvement:

1. Availability calendar UI
2. TURN server configuration
3. Session recording
4. Screen sharing
5. Rate limiting
6. Automated tests

---

## License

See project LICENSE file.

---

**Built with ❤️ by the Pana Mia Club community**
