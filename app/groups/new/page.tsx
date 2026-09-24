import { CreateGroupForm } from '../_components/create-group-form';

/**
 * /groups/new - start a group.
 *
 * Its own route rather than a dialog on /groups. The form asks six questions,
 * two of which (who can read it, who can join) are decisions the founder is
 * making for everyone who ever joins, and a page gives them room to be read
 * rather than dismissed. It is also linkable, which a dialog is not -- "go
 * start the group, here" is a message people send each other.
 */

/* Typed structurally rather than as `Metadata`: the vinext `next` shim does
   not export that type. */
export const metadata = {
  title: 'Start a group | Pana Social',
  description: 'Start a group on Pana Social.',
  robots: { index: false, follow: true },
};

export default function NewGroupPage() {
  return (
    <main className="surface-cream min-h-screen pb-20">
      <div className="container mx-auto max-w-xl px-4 pt-8">
        <header className="mb-6">
          <h1 className="text-pana-ink text-2xl font-extrabold">
            Start a group
          </h1>
          <p className="text-pana-ink/65 mt-0.5 text-[14px] font-medium">
            You will be its first admin. Choose the handle carefully — it is the
            group&rsquo;s address, and editing a group is not built yet.
          </p>
        </header>

        <CreateGroupForm />
      </div>
    </main>
  );
}
