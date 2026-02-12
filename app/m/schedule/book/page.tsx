import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { BookingForm } from './_components/booking-form';

export default async function BookSessionPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Book a Session</h1>
      <BookingForm />
    </div>
  );
}
