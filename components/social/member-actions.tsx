'use client';

/**
 * The management controls that hang off a member row.
 *
 * Three separate shapes rather than one component with a mode prop, because
 * the three lists they serve ask different questions. A pending row asks
 * "yes or no", and that is two buttons, visible, because a queue you have to
 * open a menu to answer is a queue that does not get answered. A banned row
 * asks one question. An active member asks several, most of them rare, so
 * those live behind a menu -- a roster with four buttons on every row reads
 * as a control panel rather than a list of people.
 *
 * What is allowed is decided by the server; what is *shown* is decided here,
 * and the two use the same rule deliberately. Rendering a button that always
 * returns 403 teaches people to distrust the buttons.
 *
 * @see lib/federation/wrappers/group-moderation.ts
 */

import { useState } from 'react';
import {
  Ban,
  Check,
  MoreHorizontal,
  Shield,
  ShieldOff,
  UserMinus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useModerateMember,
  type GroupMemberSummary,
  type GroupModerationAction,
} from '@/lib/query/social';

type Role = 'admin' | 'moderator' | 'member';

/**
 * Whether a viewer of one rank may act on a member of another.
 *
 * The same rule the wrapper enforces, written here to decide what renders.
 * Admins reach anyone; moderators reach only plain members. Keeping the two
 * in step matters more than keeping them in one place -- this one hides
 * buttons, that one refuses requests, and a UI that cannot see the database
 * cannot share the function that does.
 */
function canActOn(viewer: Role, target: Role): boolean {
  if (viewer === 'admin') return true;
  if (viewer === 'moderator') return target === 'member';
  return false;
}

/** Approve or reject, as two visible buttons. */
export function PendingActions({
  handle,
  member,
}: {
  handle: string;
  member: GroupMemberSummary;
}) {
  const moderate = useModerateMember();
  const busy = moderate.isPending;

  const act = (action: GroupModerationAction) =>
    moderate.mutate({ handle, memberId: member.id, action });

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => act('reject')}
        aria-label={`Decline ${member.name}`}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button
        size="sm"
        className="font-extrabold"
        disabled={busy}
        onClick={() => act('approve')}
      >
        <Check className="mr-1 h-4 w-4" aria-hidden="true" />
        Approve
      </Button>
    </div>
  );
}

/** Lift a ban. One question, so one button. */
export function BannedActions({
  handle,
  member,
}: {
  handle: string;
  member: GroupMemberSummary;
}) {
  const moderate = useModerateMember();

  return (
    <Button
      size="sm"
      variant="outline"
      className="font-extrabold"
      disabled={moderate.isPending}
      onClick={() =>
        moderate.mutate({ handle, memberId: member.id, action: 'unban' })
      }
    >
      Unban
    </Button>
  );
}

/**
 * The menu on an active member.
 *
 * Remove and ban both confirm. They are the two that cannot be undone by
 * repeating them -- an accidental promotion is one click back, an accidental
 * ban is a person who has already seen the door close.
 */
export function MemberActions({
  handle,
  member,
  viewerRole,
  isSelf,
  isLastAdmin,
}: {
  handle: string;
  member: GroupMemberSummary;
  viewerRole: Role;
  /** The viewer's own row. They may change their rank but not evict themselves. */
  isSelf: boolean;
  /** The only admin left. Nothing may be done that would empty the chair. */
  isLastAdmin: boolean;
}) {
  const moderate = useModerateMember();
  const [confirm, setConfirm] = useState<'remove' | 'ban' | null>(null);

  if (!canActOn(viewerRole, member.role)) return null;

  const act = (action: GroupModerationAction, role?: Role) =>
    moderate.mutate({ handle, memberId: member.id, action, role });

  const canChangeRole = viewerRole === 'admin' && !isLastAdmin;
  const canEvict = !isSelf && !isLastAdmin;

  // A last-admin row with no available action should not show an empty menu.
  if (!canChangeRole && !canEvict) return null;

  const isModerator = member.role === 'moderator';
  const isAdmin = member.role === 'admin';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            disabled={moderate.isPending}
            aria-label={`Manage ${member.name}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {canChangeRole && (
            <>
              {!isAdmin && (
                <DropdownMenuItem onClick={() => act('setRole', 'admin')}>
                  <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                  Make admin
                </DropdownMenuItem>
              )}
              {!isModerator && (
                <DropdownMenuItem onClick={() => act('setRole', 'moderator')}>
                  <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isAdmin ? 'Step down to mod' : 'Make mod'}
                </DropdownMenuItem>
              )}
              {member.role !== 'member' && (
                <DropdownMenuItem onClick={() => act('setRole', 'member')}>
                  <ShieldOff className="mr-2 h-4 w-4" aria-hidden="true" />
                  Remove role
                </DropdownMenuItem>
              )}
            </>
          )}

          {canChangeRole && canEvict && <DropdownMenuSeparator />}

          {canEvict && (
            <>
              <DropdownMenuItem onClick={() => setConfirm('remove')}>
                <UserMinus className="mr-2 h-4 w-4" aria-hidden="true" />
                Remove from group
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => setConfirm('ban')}
              >
                <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                Ban
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'ban'
                ? `Ban ${member.name}?`
                : `Remove ${member.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'ban'
                ? 'They lose access and cannot rejoin unless you unban them. You can lift this later from the Banned list.'
                : 'They lose access to this group. Nothing stops them from joining again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm === 'ban' ? 'bg-red-600 hover:bg-red-700' : undefined
              }
              onClick={() => {
                if (confirm) act(confirm);
                setConfirm(null);
              }}
            >
              {confirm === 'ban' ? 'Ban' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
