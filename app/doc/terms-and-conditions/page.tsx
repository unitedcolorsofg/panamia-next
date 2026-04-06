import { redirect } from 'next/navigation';

export default function OldTermsRedirect() {
  redirect('/legal/terms');
}
