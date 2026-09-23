import { getFederationDomain } from '@/lib/federation/domain';
import { UserSettingsView } from './_components/user-settings-view';

/* A server shell around a client page.
 *
 * The settings UI is entirely interactive and stays a client component, but it
 * needs the federation domain to show a member their handle before they change
 * the screenname it is built from — and getFederationDomain() reads
 * process.env, so it can only be resolved here. Same split as
 * app/p/[user]/page.tsx. */
export default function UserEditPage() {
  return <UserSettingsView federationDomain={getFederationDomain()} />;
}
