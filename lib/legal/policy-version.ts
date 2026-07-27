/**
 * Single source of truth for consent-document versions: the terms and privacy
 * policy.json files. Consent receipts are keyed by the *major* version (the
 * integer before the dot, e.g. "0.1" -> 0), so gates and the check/record
 * endpoints derive it here rather than hardcoding or duplicating the lookup.
 */
import termsPolicy from '@/app/legal/terms/policy.json';
import privacyPolicy from '@/app/legal/privacy/policy.json';

/** Full version string for a terms module (e.g. "0.1"), or null if unknown. */
export function getModuleVersion(module: string): string | null {
  const mod = termsPolicy.modules.find(
    (m: { name: string; version?: string }) => m.name === module
  );
  return mod?.version ?? null;
}

/**
 * Full version string for a consent document: a terms module, the top-level
 * terms (no module), or the privacy policy. null for anything else.
 */
export function getDocumentVersion(
  document: string,
  module: string | null
): string | null {
  if (document === 'terms') {
    return module ? getModuleVersion(module) : termsPolicy.version;
  }
  if (document === 'privacy') {
    return privacyPolicy.version;
  }
  return null;
}

export function parseMajorVersion(version: string): number {
  return parseInt(version.split('.')[0], 10);
}

/** Major version for a terms module, or null if the module isn't in policy.json. */
export function getModuleMajorVersion(module: string): number | null {
  const version = getModuleVersion(module);
  return version === null ? null : parseMajorVersion(version);
}
