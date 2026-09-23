import Image from 'next/image';
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Users,
} from 'lucide-react';
import type { MockPost, MockProfile } from '../_data/mock-profile';

/* One status in the profile's own feed. The author is always the profile
   owner here, so it takes the profile rather than a per-post author — the
   shared timeline card in Pana Social is the one that needs both. */
export function PostCard({
  post,
  profile,
}: {
  post: MockPost;
  profile: MockProfile;
}) {
  return (
    <article className="profile-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="border-pana-ink/10 relative h-11 w-11 flex-none overflow-hidden rounded-full border-2">
          <Image
            src={profile.avatar}
            alt=""
            fill
            sizes="44px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
            <span className="truncate font-extrabold">{profile.name}</span>
            <span className="text-pana-ink/45 truncate font-bold">
              @{profile.handle}
            </span>
            <span aria-hidden="true" className="text-pana-ink/30">
              ·
            </span>
            <time className="text-pana-ink/45 flex-none font-bold">
              {post.published}
            </time>
          </div>

          {post.group && (
            <p className="text-pana-indigo mt-1 inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest uppercase">
              <Users className="h-3 w-3" aria-hidden="true" />
              Posted in {post.group}
            </p>
          )}

          <p className="mt-2 text-[15px] leading-relaxed font-medium">
            {post.body}
          </p>

          {post.image && (
            <div className="media-frame mt-3 aspect-[16/10]">
              <Image
                src={post.image}
                alt={post.imageAlt ?? ''}
                fill
                sizes="(min-width: 640px) 36rem, 100vw"
                className="object-cover"
              />
            </div>
          )}

          <div className="mt-3 flex items-center gap-6">
            <span className="post-action">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {post.repliesCount}
              <span className="sr-only">replies</span>
            </span>
            <span className="post-action">
              <Repeat2 className="h-4 w-4" aria-hidden="true" />
              {post.announcesCount}
              <span className="sr-only">boosts</span>
            </span>
            <span className="post-action">
              <Heart className="h-4 w-4" aria-hidden="true" />
              {post.likesCount}
              <span className="sr-only">likes</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          className="text-pana-ink/35 hover:text-pana-ink flex-none pointer-coarse:inline-flex pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:items-center pointer-coarse:justify-center"
          aria-label="More options"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
