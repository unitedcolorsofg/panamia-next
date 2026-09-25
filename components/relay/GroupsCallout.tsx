// Server component — the entry point to /r/groups from the Resilience page.
//
// Called "group chats" rather than "groups" everywhere a member can read it.
// The nouns collided once Pana Social shipped its own groups at /g/<handle>,
// and the two are not the same object: these are NIP-29 rooms whose messages
// live on the relay and are read in a Nostr client, while a Pana Social group
// is a page on this site. The routes and tables keep the shorter name; only
// the copy is disambiguated, because the member is the one who has to tell
// them apart.
//
// Deliberately not a nav item: group chats only mean anything once you have a
// key, and the nav is global. Placed directly after enrollment instead, where
// a member who has just generated a keypair is looking for what to do next,
// and styled as a full-width bordered block so it reads as a destination
// rather than a footnote.
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Compass, Users } from 'lucide-react';

export function GroupsCallout() {
  return (
    <section className="bg-muted/40 mb-12 rounded-lg border p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Users className="h-5 w-5" />
        Group chats
      </h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Start a group chat for your neighborhood, your crew, or whatever
        you&rsquo;re organizing — invite-only, or open to every pana. The chat
        itself happens in your Nostr app; this is where the group chat gets made
        and who&rsquo;s in it gets decided.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/r/groups">Your group chats</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/r/groups/browse">
            <Compass className="mr-2 h-4 w-4" />
            Browse open group chats
          </Link>
        </Button>
      </div>
    </section>
  );
}
