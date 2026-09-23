import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOCK_EMPTY_STEPS, MOCK_POSTS, MOCK_VIEWER } from '../_data/mock-feed';
import { FeedPostCard } from './feed-post-card';
import { SuggestionsModule } from './feed-modules';

/* The empty feed.
 *
 * This is the state in the screenshot that started the redesign: a grey panel,
 * a wifi glyph, and the words "No posts yet." Three things are wrong with it.
 * It reads as a failure rather than as a beginning; it gives the reader
 * nothing to do; and it is a lie by omission, because Pana Mia is full of
 * posts — this particular account just has not followed anyone yet.
 *
 * So this state does the opposite on all three counts: it names the situation
 * plainly, it lists the three actions that fix it in the order that fixes it
 * fastest, and then it falls through to the county timeline so there is
 * something to actually read while you decide.
 *
 * The rule this encodes: the feed is never empty. If there is nothing from
 * your Panas, show the county. An empty column is a design choice, not a data
 * condition. */
export function FeedEmpty() {
  /* Posts from outside the reader's follows — the fallback the real query
     would run when the Panas timeline comes back with nothing. Filtered to the
     reader's own county, because the copy under it promises Miami-Dade and a
     Broward post under that sentence is the kind of small lie that teaches
     people not to trust the rest of the page. The reader's own post is dropped
     too: the invitation is to follow these people, and you cannot follow
     yourself. */
  const countyPosts = MOCK_POSTS.filter(
    (post) =>
      post.author.county === MOCK_VIEWER.county &&
      post.author.handle !== MOCK_VIEWER.handle
  ).slice(0, 2);

  return (
    <div className="mt-6 space-y-6">
      <section className="surface-butter border-pana-ink/12 rounded-[1.375rem] border-2 p-6 sm:p-8">
        <span className="section-eyebrow">Your feed</span>

        <h2 className="mt-3 text-[1.75rem] leading-[1.1] font-black tracking-tight sm:text-[2.125rem]">
          It&apos;s quiet in here.
          <br />
          <span className="text-pana-burnt italic">
            Three moves and it won&apos;t be.
          </span>
        </h2>

        <p className="section-lede text-pana-ink/75 mt-3">
          Nothing has landed yet because your feed is built from the Panas you
          follow, and right now that list is short. Here is the fastest way to
          fill it.
        </p>

        <ol className="mt-6 space-y-3">
          {MOCK_EMPTY_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="border-pana-ink/12 flex flex-col gap-3 rounded-2xl border-2 bg-white/70 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="empty-step-number" aria-hidden="true">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] leading-tight font-extrabold">
                  {step.title}
                </h3>
                <p className="text-pana-ink/70 mt-1 text-[13px] leading-snug font-medium">
                  {step.description}
                </p>
                <p className="text-pana-indigo mt-1.5 text-[12px] font-extrabold tracking-wide uppercase">
                  {step.payoff}
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="border-pana-ink/25 hover:border-pana-indigo hover:text-pana-indigo flex-none rounded-full font-extrabold"
              >
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      </section>

      <SuggestionsModule />

      {/* The fallback timeline. Labelled honestly — these are not your Panas,
          and pretending otherwise would make the Panas filter meaningless the
          first time someone actually followed a person. */}
      <section aria-labelledby="feed-county-fallback">
        <div className="feed-end mb-4">
          <span>While you decide</span>
        </div>

        <h2 id="feed-county-fallback" className="sr-only">
          Recent posts from {MOCK_VIEWER.county}
        </h2>
        <p className="text-pana-ink/60 mb-4 text-center text-[13px] font-bold">
          Posts from across {MOCK_VIEWER.county}. Follow anyone here and they
          move into your feed for good.
        </p>

        <div className="space-y-4">
          {countyPosts.map((post) => (
            <FeedPostCard key={post.id} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
