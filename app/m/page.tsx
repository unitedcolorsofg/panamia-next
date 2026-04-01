import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Calendar, User, Video } from 'lucide-react';

export default function MentoringPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Peer Mentoring</h1>
        <p className="text-muted-foreground mt-2">
          Connect with community members for guidance, advice, and shared
          experience.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <Search className="text-muted-foreground h-6 w-6" />
            <CardTitle className="text-base">Discover</CardTitle>
            <CardDescription>
              Find mentors by expertise and availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/m/discover">Browse Mentors</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <Calendar className="text-muted-foreground h-6 w-6" />
            <CardTitle className="text-base">Sessions</CardTitle>
            <CardDescription>
              View and manage your scheduled sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/m/schedule">My Schedule</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <User className="text-muted-foreground h-6 w-6" />
            <CardTitle className="text-base">Your Profile</CardTitle>
            <CardDescription>
              Set up your mentoring bio and availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/m/profile">Mentoring Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <Video className="text-muted-foreground h-6 w-6" />
            <CardTitle className="text-base">Video Test</CardTitle>
            <CardDescription>
              WebRTC peer-to-peer video via Durable Objects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/m/webrtc-test">Try It</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
