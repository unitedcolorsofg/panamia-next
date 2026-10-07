import { redirect } from 'next/navigation';

/*
 * The become-a-pana form is retired. It predated the split between a member's
 * own 1:1 profile (`profiles.userId`) and a business listing administered
 * through `profileOwners`, and worked by flipping `users.accountType` so that
 * someone's personal profile *became* the business. Under the current model a
 * business is its own listing row, owned by one or more panas, which is what
 * lets a person run several of them.
 *
 * Kept as a redirect rather than deleted so existing links, bookmarks and the
 * indexed URL keep resolving. /form/get-listed is the public intake
 * that replaces it.
 */
export default function BecomeAPanaFormRedirect() {
  redirect('/form/get-listed');
}
