import fs from 'fs';

/* The package's own metadata: the name and the version are read from its manifest so that no second copy exists. A module
 * of its own because these data describe the packaging rather than a consumer project, and the contract of the data needs
 * them.
 *
 * With no manifest (someone else's build) the placeholder stays: the version is needed in the data alone, and a missing
 * manifest is no reason not to build a report. */
export let TOOL_PKG = { name: '@vernikr/size-report', version: '0.0.0' };
try {
  TOOL_PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
} catch (_e) {}

/* How the package is installed into a project — the git link to the release, the pinned form `README.md` teaches: the
 * advice has to name the revision the documentation describes rather than whatever the registry serves as the latest one.
 * The address and the version come from the manifest, so the advice cannot drift from the release, and with no address
 * (`null`) there is nothing to name. */
export function installSpec() {
  const repo = TOOL_PKG.repository === undefined ? ''
    : (typeof TOOL_PKG.repository === 'string' ? TOOL_PKG.repository : TOOL_PKG.repository.url || '');
  const m = repo.match(/github\.com[:/]+([^/\s]+\/[^/\s]+?)(?:\.git)?$/);
  return m === null ? null : 'github:' + m[1] + '#v' + TOOL_PKG.version;
}
