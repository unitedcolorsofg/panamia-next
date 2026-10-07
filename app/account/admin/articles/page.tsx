import { redirect } from 'next/navigation';

// The admin console moved from /account/admin/* to /admin/*. This stays so the
// links already sitting in staff notification emails keep working.
export default function Page() {
  redirect('/admin/articles');
}