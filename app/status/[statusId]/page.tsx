import { redirect, notFound } from 'next/navigation';
import { getStatus } from '@/lib/federation/wrappers/status';

export default async function StatusRedirectPage({
  params,
}: {
  params: Promise<{ statusId: string }>;
}) {
  const { statusId } = await params;

  const status = await getStatus(statusId);

  if (!status) {
    notFound();
  }

  redirect(`/p/${status.actor.username}/${statusId}/`);
}
