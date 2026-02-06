import { redirect } from 'next/navigation';

interface ArticleEditRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticleEditRedirect({
  params,
}: ArticleEditRedirectProps) {
  const { slug } = await params;
  redirect(`/a/${slug}/edit`);
}
