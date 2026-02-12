'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface BookSessionButtonProps {
  handle: string;
}

export function BookSessionButton({ handle }: BookSessionButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const handleBookSession = () => {
    if (!session) {
      router.push('/api/auth/signin');
      return;
    }
    router.push(`/m/schedule/book?mentor=${handle}`);
  };

  return (
    <Button onClick={handleBookSession} size="lg" className="gap-2">
      <Calendar className="h-4 w-4" aria-hidden="true" />
      Book Session
    </Button>
  );
}
