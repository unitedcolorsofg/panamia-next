'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { signInPath } from '@/lib/signin-redirect';

interface BookSessionButtonProps {
  handle: string;
}

export function BookSessionButton({ handle }: BookSessionButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const handleBookSession = () => {
    const target = `/m/schedule/book?mentor=${encodeURIComponent(handle)}`;
    if (!session) {
      /* Signing in used to drop the member on the directory with no mentor
         and no clue, which reads as the button having done nothing. */
      router.push(signInPath(target));
      return;
    }
    router.push(target);
  };

  return (
    <Button onClick={handleBookSession} size="lg" className="gap-2">
      <Calendar className="h-4 w-4" aria-hidden="true" />
      Book Session
    </Button>
  );
}
