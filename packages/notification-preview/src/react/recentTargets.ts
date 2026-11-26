/** How many targets the Send test tab offers again. */
const KEPT = 5;

/** The newest first, one of each whatever its letter case, and no more than are kept. */
function listed(targets: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const target of targets) {
    if (typeof target !== 'string' || target.trim() === '' || seen.has(target.toLowerCase())) continue;
    seen.add(target.toLowerCase());
    kept.push(target);
  }
  return kept.slice(0, KEPT);
}

// The store may be blocked or throw, as in a private window; the field then starts empty.
export function recentTargets(key: string): string[] {
  try {
    const found: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(found) ? listed(found) : [];
  } catch {
    return [];
  }
}

/**
 * Puts a target a test went to first in the list kept under `key`, in this browser only, and
 * answers the list.
 */
export function rememberTarget(key: string, target: string): string[] {
  const targets = listed([target, ...recentTargets(key)]);
  try {
    localStorage.setItem(key, JSON.stringify(targets));
  } catch {
    // Kept for this visit only.
  }
  return targets;
}
