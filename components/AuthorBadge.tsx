'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';

interface AuthorData {
  screenname?: string;
  name?: string;
  verified?: boolean;
  deleted?: boolean;
}

interface AuthorBadgeProps {
  authorId: string;
  showVerification?: boolean;
  className?: string;
}

export default function AuthorBadge({
  authorId,
  showVerification = true,
  className = '',
}: AuthorBadgeProps) {
  const [author, setAuthor] = useState<AuthorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const response = await fetch(`/api/user/author/${authorId}`);
        if (response.ok) {
          const data = await response.json();
          setAuthor(data);
        } else {
          setAuthor({ deleted: true });
        }
      } catch {
        setAuthor({ deleted: true });
      } finally {
        setLoading(false);
      }
    };

    if (authorId) {
      fetchAuthor();
    } else {
      setLoading(false);
      setAuthor({ deleted: true });
    }
  }, [authorId]);

  if (loading) {
    return (
      <span className={`inline-block animate-pulse ${className}`}>
        <span className="inline-block h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      </span>
    );
  }

  if (!author || author.deleted) {
    return (
      <span className={`text-gray-500 italic ${className}`}>Former Member</span>
    );
  }

  const displayName = author.screenname || author.name || 'Anonymous';

  const content = (
    <>
      <span>{displayName}</span>
      {showVerification && author.verified && (
        <BadgeCheck
          className="ml-1 inline-block h-4 w-4 text-blue-500"
          aria-label="Verified"
        />
      )}
    </>
  );

  // Link to profile if screenname available
  if (author.screenname) {
    return (
      <Link
        href={`/p/${author.screenname}/`}
        className={`font-medium text-blue-600 hover:underline dark:text-blue-400 ${className}`}
      >
        {content}
      </Link>
    );
  }

  // No screenname - just display the name
  return (
    <span
      className={`font-medium text-gray-900 dark:text-gray-100 ${className}`}
    >
      {content}
    </span>
  );
}
