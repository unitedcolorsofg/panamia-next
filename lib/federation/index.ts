/**
 * Federation Module
 *
 * This module provides ActivityPub federation capabilities for panamia.club,
 * integrating with activities.next as a capability provider.
 *
 * IMPORTANT: The external/activities.next/ directory is READ-ONLY.
 * All integration happens through wrapper modules in this directory.
 *
 * @see docs/SOCIAL-ROADMAP.md for implementation details
 */

export const federationConfig = {
  enabled: process.env.FEDERATION_ENABLED === 'true',
  domain: process.env.FEDERATION_DOMAIN || 'panamia.club',
  instanceName: process.env.FEDERATION_INSTANCE_NAME || 'Pana Mia Club',
  instanceDescription: process.env.FEDERATION_INSTANCE_DESCRIPTION,
  adminEmail: process.env.FEDERATION_ADMIN_EMAIL,

  features: {
    autoFederateArticles:
      process.env.FEDERATION_AUTO_FEDERATE_ARTICLES === 'true',
    allowRemoteFollows: process.env.FEDERATION_ALLOW_REMOTE_FOLLOWS !== 'false',
    allowRemoteInteractions:
      process.env.FEDERATION_ALLOW_REMOTE_INTERACTIONS !== 'false',
  },

  // ActivityPub endpoints
  endpoints: {
    webfinger: '/.well-known/webfinger',
    nodeinfo: '/.well-known/nodeinfo',
    actor: (screenname: string) => `/users/${screenname}`,
    inbox: (screenname: string) => `/users/${screenname}/inbox`,
    outbox: (screenname: string) => `/users/${screenname}/outbox`,
    followers: (screenname: string) => `/users/${screenname}/followers`,
    following: (screenname: string) => `/users/${screenname}/following`,
  },
};

/**
 * Check if federation is enabled
 */
export function isFederationEnabled(): boolean {
  return federationConfig.enabled;
}

/**
 * Get the full ActivityPub actor URL for a screenname
 */
export function getActorUrl(screenname: string): string {
  return `https://${federationConfig.domain}${federationConfig.endpoints.actor(screenname)}`;
}

/**
 * Get the inbox URL for a screenname
 */
export function getInboxUrl(screenname: string): string {
  return `https://${federationConfig.domain}${federationConfig.endpoints.inbox(screenname)}`;
}

/**
 * Get the outbox URL for a screenname
 */
export function getOutboxUrl(screenname: string): string {
  return `https://${federationConfig.domain}${federationConfig.endpoints.outbox(screenname)}`;
}
