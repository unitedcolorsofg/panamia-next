import { DirectorySuggest } from '@/components/directory-suggest';

/**
 * The search field a surface carries in the middle of its masthead.
 *
 * It was a plain GET form, so that it worked before the bundle landed and on a
 * page with JavaScript off. It is now the club-wide typeahead, which keeps
 * that: `DirectorySuggest` renders a real GET with a real `name="q"` and only
 * preventDefaults once hydrated, so the no-JS path is the same document
 * navigation it always was. That is also why it still sidesteps the
 * stale-chrome problem `SurfaceLink` exists for — submitting reaches the
 * server, which picks the chrome again on the way in.
 *
 * `scope="group"` is a narrowing, and the reasoning is worth keeping. The
 * field used to point at Pana Social's own `/search`, which covered Panas and
 * groups; it then briefly pointed at the directory's Everything scope, which
 * covered all four kinds. Everything is gone — the search box now searches
 * exactly one kind, named by the control next to it — and this layout has no
 * room for that control, so the field has to commit to a scope rather than
 * offer a choice.
 *
 * Groups, of the two kinds this field has always been for, because groups are
 * the half that is now public. Panas still require sign-in, and a masthead
 * sits in chrome that does not know who is looking: defaulting it to a gated
 * scope would mean an anonymous visitor on a surface types a name, submits,
 * and is answered with a sign-in wall. Groups answer everyone.
 *
 * A member who wants the other three kinds has the scope menu on the homepage
 * and the explore pages themselves; this field is the shortcut, not the index.
 *
 * Rendered from a server component; `DirectorySuggest` is the client boundary.
 */
export function SurfaceSearch({ surfaceName }: { surfaceName: string }) {
  // One string for the input's accessible name and the listbox's, so a screen
  // reader hears the same field named the same way twice rather than two.
  const label = `Search ${surfaceName} groups`;

  return (
    <DirectorySuggest
      layout="masthead"
      scope="group"
      className="panaverse-search"
      label={label}
      ariaLabel={label}
      placeholder="Search groups"
    />
  );
}
