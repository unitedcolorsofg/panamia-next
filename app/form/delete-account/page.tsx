import dynamic from 'next/dynamic';

const DeleteAccountForm = dynamic(() => import('./DeleteAccountForm'), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg">Loading...</p>
    </div>
  ),
});

export default function DeleteAccountPage() {
  return <DeleteAccountForm />;
}
