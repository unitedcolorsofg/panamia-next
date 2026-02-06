import { redirect } from 'next/navigation';

interface ArticleReviewRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticleReviewRedirect({
  params,
}: ArticleReviewRedirectProps) {
  const { slug } = await params;
  redirect(`/a/${slug}/review`);
}
