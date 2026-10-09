'use client';

import Image from 'next/image';
import {
  CalendarDays,
  Compass,
  MessageCircle,
  PenLine,
  Star,
  User,
  Users,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from '@/components/account/identity.module.css';
import { MOCK_MEMBER } from '../../_data/panaverse';
import { MOCK_HOST, MOCK_PATH } from '../_data';

/**
 * The account menu, reproduced so the second half of the request is visible.
 *
 * "The events button in the profile menu will also guide the user there" is a
 * claim about this grid, and a claim about a grid is only reviewable next to
 * the page it lands on. So the menu is drawn here, open, with the Events tile
 * lit and its destination written underneath — rather than described in a
 * paragraph that nobody can click.
 *
 * It is a faithful copy of `components/account/pana-sites.tsx`: the same
 * `identity.module.css` imported from the real component, the same tile order
 * as `PANA_SITES`, the same `tileComingSoon` treatment for the two offerings
 * that are named but unbuilt, the same Account tile leading the grid. Only
 * three things changed, all for the same reason — the real one needs a
 * session, a host and an i18n bundle, and a mock has none of the three:
 *
 * 1. Labels are literals instead of `t('identity.sites.*')` keys.
 * 2. Tiles are buttons instead of `SurfaceLink`, so a click cannot navigate
 *    out of the mock.
 * 3. The admin tile is omitted — it is staff-only and this viewer is not.
 *
 * The one genuine proposal is the Events tile's `href`. In the live registry
 * it is `/e`, a room on whichever surface is serving. If the directory becomes
 * a surface, that entry becomes an absolute URL on it, which
 * `resolvePanaSites` already does unprompted for every site whose owning
 * surface differs from the host in hand. That is the whole change: one href in
 * `lib/panaverse/sites.ts`, plus the surface existing. No component here moves.
 */
interface MockTile {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Null renders the dimmed "coming soon" treatment, as in the real grid. */
  href: string | null;
  /** The tile for the page we are standing on. */
  current?: boolean;
}

const TILES: MockTile[] = [
  { id: 'account', label: 'Account', icon: User, href: '/account' },
  { id: 'social', label: 'Pana Social', icon: MessageCircle, href: '/s' },
  { id: 'ink', label: 'Pana Ink', icon: PenLine, href: null },
  { id: 'vizion', label: 'Pana Vizion', icon: Video, href: '/podcasts' },
  {
    id: 'directory',
    label: 'Directory',
    icon: Compass,
    href: `https://${MOCK_HOST}/`,
  },
  {
    id: 'events',
    label: 'Events',
    icon: CalendarDays,
    href: `https://${MOCK_HOST}${MOCK_PATH}`,
    current: true,
  },
  { id: 'getInvolved', label: 'Get involved', icon: Users, href: null },
  { id: 'connectors', label: 'Connectors', icon: Star, href: '/connectors' },
];

export function AccountMenu({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.anchor}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
      >
        <span className={styles.avatar}>
          <Image
            src={MOCK_MEMBER.avatar}
            alt=""
            width={34}
            height={34}
            className={styles.avatarImg}
          />
        </span>
      </button>

      <div
        className={open ? `${styles.menu} ${styles.menuOpen}` : styles.menu}
        role="menu"
        aria-hidden={!open}
      >
        <div className={styles.row}>
          <span className={styles.avatar}>
            <Image
              src={MOCK_MEMBER.avatar}
              alt=""
              width={34}
              height={34}
              className={styles.avatarImg}
            />
          </span>
          <span className={styles.rowMeta}>
            <span className={styles.rowName}>{MOCK_MEMBER.name}</span>
            <span className={styles.rowHandle}>
              {MOCK_MEMBER.fediverseHandle}
            </span>
          </span>
        </div>

        <div className={styles.separator} />

        <div className={styles.tileGrid}>
          {TILES.map((tile) => {
            const Icon = tile.icon;

            if (!tile.href) {
              return (
                <div
                  key={tile.id}
                  className={`${styles.tile} ${styles.tileComingSoon}`}
                  aria-disabled="true"
                >
                  <span className={styles.tileIcon} aria-hidden="true">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className={styles.tileLabel}>{tile.label}</span>
                  <span className={styles.tileSoon}>Coming soon</span>
                </div>
              );
            }

            return (
              <button
                key={tile.id}
                type="button"
                role="menuitem"
                /* `.rowActive` is the menu's own "this is where you are" tint,
                   borrowed from the rows above rather than invented for tiles,
                   so the menu has one highlight and not two. On this mock the
                   tint alone is too quiet to carry the point — the Events tile
                   is the control being rewired, so it also gets the outline
                   that the footnote below is talking about. */
                className={
                  tile.current
                    ? `${styles.tile} ${styles.rowActive} ring-pana-indigo/45 rounded-xl ring-2 ring-inset`
                    : styles.tile
                }
                aria-current={tile.current ? 'page' : undefined}
              >
                <span className={styles.tileIcon} aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className={styles.tileLabel}>{tile.label}</span>
              </button>
            );
          })}
        </div>

        {/* Not part of the real menu — the one piece of mock scaffolding
            inside the chrome, because the href is the thing being proposed and
            a tile does not show its own destination. */}
        <p className="text-pana-ink/55 border-pana-ink/10 mt-1 border-t px-3 py-2 text-[10.5px] leading-snug font-semibold">
          Events now opens{' '}
          <span className="text-pana-ink font-black">
            {MOCK_HOST}
            {MOCK_PATH}
          </span>
          <br />
          <span className="opacity-80">
            today it is /e on whichever host you are on
          </span>
        </p>
      </div>
    </div>
  );
}
