'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Session {
  _id: string;
  sessionId: string;
  mentorEmail: string;
  menteeEmail: string;
  scheduledAt: string;
  duration: number;
  topic: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

interface SessionsListProps {
  sessions: Session[];
  userEmail: string;
  type: 'upcoming' | 'past';
}

export function SessionsList({ sessions, userEmail, type }: SessionsListProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<string | null>(null);

  const handleCancel = async (sessionId: string) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;

    setCancelling(sessionId);
    try {
      const response = await fetch(`/api/mentoring/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          sessionId,
          reason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel session');
      }

      router.refresh();
    } catch (error) {
      console.error('Error cancelling session:', error);
      alert('Failed to cancel session');
    } finally {
      setCancelling(null);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="bg-card text-muted-foreground rounded-lg border p-6 text-center">
        No {type} sessions
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => {
        const isMentor = session.mentorEmail === userEmail;
        const otherParty = isMentor ? session.menteeEmail : session.mentorEmail;
        const role = isMentor ? 'Mentor' : 'Mentee';
        const scheduledDate = new Date(session.scheduledAt);

        return (
          <Card key={session._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{session.topic}</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    {role} session with {otherParty}
                  </p>
                </div>
                <Badge
                  variant={
                    session.status === 'scheduled'
                      ? 'default'
                      : session.status === 'completed'
                        ? 'secondary'
                        : 'destructive'
                  }
                >
                  {session.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Date:</span>{' '}
                  {scheduledDate.toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold">Time:</span>{' '}
                  {scheduledDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div>
                  <span className="font-semibold">Duration:</span>{' '}
                  {session.duration} min
                </div>
                <div>
                  <span className="font-semibold">Session ID:</span>{' '}
                  {session.sessionId}
                </div>
              </div>

              {session.status === 'cancelled' && session.cancelReason && (
                <div className="rounded bg-red-50 p-3 text-sm">
                  <p className="font-semibold text-red-800">
                    Cancelled by {session.cancelledBy}
                  </p>
                  <p className="mt-1 text-red-700">{session.cancelReason}</p>
                </div>
              )}

              {session.notes && (
                <div className="bg-muted rounded p-3 text-sm">
                  <p className="mb-1 font-semibold">Session Notes:</p>
                  <p className="whitespace-pre-wrap">{session.notes}</p>
                </div>
              )}

              {type === 'upcoming' && session.status === 'scheduled' && (
                <div className="flex space-x-2">
                  <Link href={`/mentoring/session/${session.sessionId}`}>
                    <Button>Join Session</Button>
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => handleCancel(session.sessionId)}
                    disabled={cancelling === session.sessionId}
                  >
                    {cancelling === session.sessionId
                      ? 'Cancelling...'
                      : 'Cancel'}
                  </Button>
                </div>
              )}

              {type === 'past' && session.status === 'completed' && (
                <Link href={`/mentoring/session/${session.sessionId}`}>
                  <Button variant="outline">View Session Details</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
