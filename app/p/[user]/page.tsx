import { redirect } from 'next/navigation';

export default async function ShortProfileRedirect({
  params,
}: {
  params: Promise<{ user: string }>;
}) {
  const { user } = await params;
  redirect(`/profile/${user}/`);
}
