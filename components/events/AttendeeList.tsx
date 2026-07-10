'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface Attendee {
  id: string;
  name: string;
  email: string;
  status: 'going' | 'maybe' | 'not_going';
  emailVerifiedAt: string | null;
  respondedAt: string | null;
  profileId: string | null;
}

interface Counts {
  going: number;
  maybe: number;
  pending: number;
}

const STATUS_LABEL: Record<Attendee['status'], string> = {
  going: 'Going',
  maybe: 'Maybe',
  not_going: "Can't go",
};

export default function AttendeeList({ slug }: { slug: string }) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${slug}/rsvp/list`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to load');
        setAttendees(data.data.attendees);
        setCounts(data.data.counts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {counts && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{counts.going} going</Badge>
          <Badge variant="outline">{counts.maybe} maybe</Badge>
          <Badge variant="outline">{counts.pending} unconfirmed</Badge>
        </div>
      )}

      {attendees.length === 0 ? (
        <p className="text-gray-500">No RSVPs yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confirmed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendees.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-gray-500">{a.email}</TableCell>
                <TableCell>{STATUS_LABEL[a.status]}</TableCell>
                <TableCell>
                  {a.emailVerifiedAt ? (
                    <Badge variant="secondary">Confirmed</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
