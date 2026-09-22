'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Who is looking at this profile.
 *
 * `business` is a real state, not a hypothetical: an account can exist to
 * manage a listing without there being a person behind it in the social graph.
 * Saving and recommending are personal acts, so a business-only account is
 * gated the same as a stranger — it just gets different copy, because telling
 * someone who is already signed in to "sign up" reads as broken.
 */
export type ViewerKind = 'anon' | 'business' | 'pana';

/**
 * The actions that write something to your pana identity.
 *
 * Note what is deliberately absent: the outbound links, Share, and the event
 * cards. Those either send people to the business or cost the visitor nothing,
 * and a directory that demands an account before it will tell you a
 * restaurant's address has forgotten who it is for. The gate exists to protect
 * the integrity of counts and the social graph, not to harvest signups.
 */
export type GateAction = 'save' | 'recommend' | 'react' | 'reply' | 'boost';

const ACTION_EYEBROW: Record<GateAction, string> = {
  save: 'To save this business',
  recommend: 'To recommend this business',
  react: 'To react to this update',
  reply: 'To reply to this update',
  boost: 'To boost this update',
};

const ACTION_REASON: Record<GateAction, string> = {
  save: 'Saved businesses live in your account so you can find them again, and the count on this page goes up by one.',
  recommend:
    'A recommendation is public and puts your name behind this business. That only means something coming from a real pana.',
  react:
    'Likes come from your pana profile, so the business knows who is listening.',
  reply:
    'Replies post to Pana Social under your screenname, and the business can answer you back.',
  boost:
    'Boosting puts this update in front of the panas who follow you, so it has to come from somewhere.',
};

const PANA_PERKS = [
  'Save businesses you want to come back to',
  'Recommend the ones worth vouching for',
  'Follow their updates on Pana Social',
];

interface PanaGateValue {
  viewer: ViewerKind;
  isPana: boolean;
  /**
   * Returns `true` when the viewer may proceed. Returns `false` and opens the
   * signup dialog when they may not, so callers read as a plain guard:
   *
   *   if (!requirePana('save')) return;
   */
  requirePana: (action: GateAction) => boolean;
}

const PanaGateContext = createContext<PanaGateValue | null>(null);

export function usePanaGate(): PanaGateValue {
  const value = useContext(PanaGateContext);
  if (!value) {
    throw new Error('usePanaGate must be used inside <PanaGateProvider>');
  }
  return value;
}

interface PanaGateProviderProps {
  viewer: ViewerKind;
  businessName: string;
  businessLogo: string;
  children: ReactNode;
}

export function PanaGateProvider({
  viewer,
  businessName,
  businessLogo,
  children,
}: PanaGateProviderProps) {
  const [blockedAction, setBlockedAction] = useState<GateAction | null>(null);
  const isPana = viewer === 'pana';

  const requirePana = useCallback(
    (action: GateAction) => {
      if (viewer === 'pana') {
        return true;
      }
      setBlockedAction(action);
      return false;
    },
    [viewer]
  );

  const value = useMemo(
    () => ({ viewer, isPana, requirePana }),
    [viewer, isPana, requirePana]
  );

  return (
    <PanaGateContext.Provider value={value}>
      {children}
      <SignupDialog
        action={blockedAction}
        viewer={viewer}
        businessName={businessName}
        businessLogo={businessLogo}
        onClose={() => setBlockedAction(null)}
      />
    </PanaGateContext.Provider>
  );
}

interface SignupDialogProps {
  action: GateAction | null;
  viewer: ViewerKind;
  businessName: string;
  businessLogo: string;
  onClose: () => void;
}

/**
 * The interruption itself.
 *
 * Three things it does on purpose:
 *
 * 1. It names the action in the eyebrow. A modal that appears with no
 *    explanation of which click caused it feels like an ad; one that says "to
 *    save this business" is answering a question the visitor just asked.
 * 2. It is dismissible, and the dismissal is worded "Keep browsing" rather
 *    than "No thanks". The directory works fine signed out and should say so —
 *    a dead-end modal on a public listing page would cost the business the
 *    visit.
 * 3. It shows the logo and name. By the time the dialog is open the page is
 *    covered, and the signup is only persuasive if you remember what you were
 *    about to do and for whom.
 */
function SignupDialog({
  action,
  viewer,
  businessName,
  businessLogo,
  onClose,
}: SignupDialogProps) {
  // Keep the last action around while the dialog animates out, otherwise the
  // copy blanks for the duration of the close transition.
  const [lastAction, setLastAction] = useState<GateAction>('save');
  if (action && action !== lastAction) {
    setLastAction(action);
  }

  const resolved = action ?? lastAction;
  const signedInAsBusiness = viewer === 'business';

  return (
    <Dialog open={action !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bizprofile-gate">
        <div className="bizprofile-gate-head">
          <span className="bizprofile-gate-logo">
            <Image
              src={businessLogo}
              alt=""
              width={44}
              height={44}
              aria-hidden="true"
            />
          </span>
          <span className="bizprofile-gate-biz">{businessName}</span>
        </div>

        <span className="section-eyebrow mt-6">
          {ACTION_EYEBROW[resolved]}
        </span>

        <DialogTitle className="bizprofile-gate-title">
          {signedInAsBusiness
            ? 'You need a pana account'
            : 'Sign up to be a pana'}
        </DialogTitle>

        <DialogDescription className="bizprofile-gate-reason">
          {signedInAsBusiness
            ? `You are signed in with a business account. ${ACTION_REASON[resolved]}`
            : ACTION_REASON[resolved]}
        </DialogDescription>

        {!signedInAsBusiness && (
          <ul className="bizprofile-gate-list">
            {PANA_PERKS.map((perk) => (
              <li key={perk}>
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="bg-pana-flame text-pana-ink hover:bg-pana-burnt flex-1 rounded-full font-extrabold"
          >
            <Link href="/form/become-a-pana">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {signedInAsBusiness ? 'Add a pana account' : 'Become a Pana'}
            </Link>
          </Button>

          {!signedInAsBusiness && (
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-pana-ink/25 text-pana-ink hover:bg-pana-butter-2 flex-1 rounded-full border-2 bg-white font-extrabold"
            >
              <Link href="/signin">I already have one</Link>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="bizprofile-gate-dismiss"
          onClick={onClose}
        >
          Keep browsing
        </button>
      </DialogContent>
    </Dialog>
  );
}
