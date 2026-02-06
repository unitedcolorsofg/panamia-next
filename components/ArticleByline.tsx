/**
 * ArticleByline Component
 *
 * UPSTREAM REFERENCE: external/activities.next/lib/activities/actions/
 * Author, co-authors, and reviewer attribution for articles
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, User } from 'lucide-react';

interface AuthorInfo {
  _id: string;
  screenname?: string;
  name?: string;
  profileSlug?: string;
  verified?: boolean;
}

interface ArticleBylineProps {
  authorId: string;
  coAuthors?: Array<{
    userId: string;
    status: string;
  }>;
  reviewerId?: string;
  publishedAt?: string;
  readingTime?: number;
}

function AuthorLink({
  author,
  prefix,
}: {
  author: AuthorInfo | null;
  prefix?: string;
}) {
  if (!author) {
    return (
      <span className="text-gray-500">
        {prefix && `${prefix} `}Former Member
      </span>
    );
  }

  const displayName = author.screenname
    ? `@${author.screenname}`
    : author.name || 'Anonymous';

  if (author.profileSlug) {
    return (
      <Link
        href={`/profile/${author.profileSlug}`}
        className="inline-flex items-center gap-1 font-medium hover:text-blue-600 dark:hover:text-blue-400"
      >
        {prefix && <span className="font-normal text-gray-500">{prefix}</span>}
        {displayName}
        {author.verified && (
          <CheckCircle
            className="h-4 w-4 text-blue-500"
            aria-label="Verified"
          />
        )}
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 font-medium">
      {prefix && <span className="font-normal text-gray-500">{prefix}</span>}
      {displayName}
      {author.verified && (
        <CheckCircle className="h-4 w-4 text-blue-500" aria-label="Verified" />
      )}
    </span>
  );
}

export default function ArticleByline({
  authorId,
  coAuthors = [],
  reviewerId,
  publishedAt,
  readingTime,
}: ArticleBylineProps) {
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [coAuthorInfos, setCoAuthorInfos] = useState<(AuthorInfo | null)[]>([]);
  const [reviewer, setReviewer] = useState<AuthorInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAuthorInfo() {
      try {
        // Fetch main author
        const authorRes = await fetch(`/api/user/author/${authorId}`);
        const authorData = await authorRes.json();
        if (!authorData.deleted) {
          setAuthor(authorData);
        }

        // Fetch accepted co-authors
        const acceptedCoAuthors = coAuthors.filter(
          (ca) => ca.status === 'accepted'
        );
        const coAuthorPromises = acceptedCoAuthors.map(async (ca) => {
          const res = await fetch(`/api/user/author/${ca.userId}`);
          const data = await res.json();
          return data.deleted ? null : data;
        });
        const coAuthorResults = await Promise.all(coAuthorPromises);
        setCoAuthorInfos(coAuthorResults);

        // Fetch reviewer if present
        if (reviewerId) {
          const reviewerRes = await fetch(`/api/user/author/${reviewerId}`);
          const reviewerData = await reviewerRes.json();
          if (!reviewerData.deleted) {
            setReviewer(reviewerData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch author info:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAuthorInfo();
  }, [authorId, coAuthors, reviewerId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <User className="h-4 w-4 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-gray-500">By</span>
        <AuthorLink author={author} />
        {coAuthorInfos.map((coAuthor, index) => (
          <span key={coAuthor?._id || index} className="flex items-center">
            <span className="text-gray-500">&amp;</span>
            <AuthorLink author={coAuthor} />
          </span>
        ))}
      </div>

      {reviewer && (
        <div className="text-gray-500">
          <AuthorLink author={reviewer} prefix="Reviewed by" />
        </div>
      )}

      {(formattedDate || readingTime) && (
        <div className="text-gray-500">
          {formattedDate}
          {formattedDate && readingTime && ' · '}
          {readingTime && `${readingTime} min read`}
        </div>
      )}
    </div>
  );
}
