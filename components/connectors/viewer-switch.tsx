import SurfaceLink from '@/components/panaverse/SurfaceLink';
import { type ViewerRole, VIEWER_ROLES } from '@/lib/connectors/fixtures';
import { CONNECTORS_CHROME } from '@/lib/connectors/theme';

/**
 * The mock's "viewing as" switch.
 *
 * In the real build none of this exists: whether you see the front page, the
 * HQ or the admin view falls out of the session — do you have a connector
 * record, and are you a programme admin. While Connectors is fixtures, the
 * panas still need to review all three states, and asking them to sign in and
 * out of three accounts to do it would make the review itself the hard part.
 *
 * It is a link carrying `?as=` rather than a toggle holding client state so a
 * reviewer can paste "the admin view looks wrong" into a thread with a URL
 * that actually reproduces what they saw.
 *
 * Deliberately loud. It is a scaffold, and a scaffold that looks like part of
 * the design is one somebody eventually ships.
 */

const ROLE_LABEL: Record<ViewerRole, string> = {
  visitor: 'Not a connector',
  connector: 'Connector',
  admin: 'Programme admin',
};

/** Each role implies where it belongs, which is the behaviour being demoed. */
const ROLE_HOME: Record<ViewerRole, string> = {
  visitor: '/connectors',
  connector: '/connectors/hq',
  admin: '/connectors/admin',
};

export function ViewerSwitch({ current }: { current: ViewerRole }) {
  return (
    <div className="border-b-2 border-dashed border-pana-ink/30 bg-pana-butter-2">
      <div className="container mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="text-xs font-extrabold uppercase tracking-wider text-pana-ink/60">
          Mock · viewing as
        </span>
        <nav className="flex flex-wrap gap-2" aria-label="Preview as">
          {VIEWER_ROLES.map((role) => {
            const active = role === current;
            return (
              <SurfaceLink
                key={role}
                href={`${ROLE_HOME[role]}?as=${role}`}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full border-2 border-pana-ink px-3 py-1 text-xs font-bold transition-colors ${
                  active
                    ? `${CONNECTORS_CHROME.FILL} ${CONNECTORS_CHROME.ON_FILL}`
                    : 'bg-transparent text-pana-ink hover:bg-pana-ink/10'
                }`}
              >
                {ROLE_LABEL[role]}
              </SurfaceLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
