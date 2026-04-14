import { redirect } from 'next/navigation';

// The /venues/new path has been superseded by the multi-page wizard at
// /form/submit-venue. We keep this file as a permanent redirect so bookmarks,
// docs, and existing e2e tests that reference the old path still work.
export default function NewVenueRedirect() {
  redirect('/form/submit-venue');
}
