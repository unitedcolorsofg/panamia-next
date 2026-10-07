import { redirect } from 'next/navigation';

/*
 * Renamed to /form/get-listed. The directory is not a business directory: a
 * band, a co-op or a non-profit claims the same kind of page a shop does, and
 * a URL with "business" in it told every one of them they were in the wrong
 * place before the form had a chance to say otherwise.
 *
 * Kept as a redirect rather than deleted because this path was the public
 * intake for a long time — it is linked from old posts, printed material and
 * the panas' own DMs, and it is the URL the sitemap advertised. Those links
 * have to keep resolving.
 */
export default function ListYourBusinessRedirect() {
  redirect('/form/get-listed');
}
