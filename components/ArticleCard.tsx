/**
 * ArticleCard Component
 *
 * UPSTREAM REFERENCE: https://github.com/llun/activities.next
 * Preview card for article listings
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';

interface ArticleCardProps {
  slug: string;
  title: string;
  excerpt?: string;
  articleType: 'business_update' | 'community_commentary';
  tags?: string[];
  coverImage?: string;
  readingTime?: number;
  publishedAt: string;
  author: {
    screenname?: string;
    name?: string;
  };
  coAuthorCount?: number;
}

export default function ArticleCard({
  slug,
  title,
  excerpt,
  articleType,
  tags = [],
  coverImage,
  readingTime,
  publishedAt,
  author,
  coAuthorCount = 0,
}: ArticleCardProps) {
  const formattedDate = new Date(publishedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const authorDisplay = author.screenname
    ? `@${author.screenname}`
    : author.name || 'Anonymous';

  return (
    <Link href={`/articles/${slug}`}>
      <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
        {coverImage && (
          <div className="relative aspect-video overflow-hidden">
            <Image
              src={coverImage}
              alt={title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}
        <CardContent className={coverImage ? 'pt-4' : 'pt-6'}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {articleType === 'business_update'
                ? 'Business Update'
                : 'Commentary'}
            </Badge>
            {tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <h3 className="mb-2 line-clamp-2 text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400">
            {title}
          </h3>

          {excerpt && (
            <p className="mb-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {excerpt}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span>{authorDisplay}</span>
              {coAuthorCount > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />+{coAuthorCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {readingTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {readingTime} min
                </span>
              )}
              <span>{formattedDate}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
