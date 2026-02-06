import { redirect } from 'next/navigation';

interface ArticleInviteRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticleInviteRedirect({
  params,
}: ArticleInviteRedirectProps) {
  const { slug } = await params;
  redirect(`/a/${slug}/invite`);
}
