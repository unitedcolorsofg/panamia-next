import { redirect } from 'next/navigation';

interface ArticleRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticleRedirect({
  params,
}: ArticleRedirectProps) {
  const { slug } = await params;
  redirect(`/a/${slug}`);
}
