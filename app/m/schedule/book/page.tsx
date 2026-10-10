import { auth } from '@/auth';
import { redirectToSignIn } from '@/lib/signin-redirect';
import { BookingForm } from './_components/booking-form';

export default async function BookSessionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    /* The form cannot submit without ?mentor=, so sending a signed-out member
       back to a bare /m/schedule/book hands them a page that refuses to work
       and does not say why. Carry the mentor through the sign-in round trip. */
    const params = await searchParams;
    const mentor = Array.isArray(params.mentor)
      ? params.mentor[0]
      : params.mentor;
    const query = new URLSearchParams();
    if (mentor) query.set('mentor', mentor);
    const target = query.toString()
      ? `/m/schedule/book?${query.toString()}`
      : '/m/schedule/book';
    redirectToSignIn(target);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Book a Session</h1>
      <BookingForm />
    </div>
  );
}
