import dynamic from 'next/dynamic';

const SubmitVenueForm = dynamic(() => import('./SubmitVenueForm'), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg">Loading...</p>
    </div>
  ),
});

export default function SubmitVenuePage() {
  return <SubmitVenueForm />;
}
