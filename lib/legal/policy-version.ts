/**
 * Single source of truth for terms-module versions: app/legal/terms/policy.json.
 * Consent receipts are keyed by the *major* version (the integer before the
 * dot, e.g. "0.1" -> 0), so gates derive it from policy.json rather than
 * hardcoding it.
 */
import termsPolicy from '@/app/legal/terms/policy.json';

/** Full version string for a terms module (e.g. "0.1"), or null if unknown. */
export function getModuleVersion(module: string): string | null {
  const mod = termsPolicy.modules.find(
    (m: { name: string; version?: string }) => m.name === module
  );
  return mod?.version ?? null;
}

export function parseMajorVersion(version: string): number {
  return parseInt(version.split('.')[0], 10);
}

/** Major version for a terms module, or null if the module isn't in policy.json. */
export function getModuleMajorVersion(module: string): number | null {
  const version = getModuleVersion(module);
  return version === null ? null : parseMajorVersion(version);
}

/** Major version of the top-level terms document (no module). */
export function getTermsMajorVersion(): number {
  return parseMajorVersion(termsPolicy.version);
}
