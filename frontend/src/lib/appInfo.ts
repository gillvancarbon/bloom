/**
 * App metadata and the public links shown on the About screen and in Settings.
 *
 * The version is read from package.json rather than spelled out here: it had
 * been hard-coded and quietly drifted four releases behind (it still said
 * 1.3.1 while the app shipped 1.5.3). Vite inlines the named import, so this
 * costs nothing at runtime and cannot go stale again.
 */

import pkg from '../../package.json'

export const APP_VERSION: string = pkg.version

/** The public repository. Update this if the project ever moves. */
export const REPO_URL = 'https://github.com/gillvancarbon/bloom'

export const LINKS = {
  repo: REPO_URL,
  privacy: `${REPO_URL}/blob/main/PRIVACY.md`,
  license: `${REPO_URL}/blob/main/LICENSE`,
  guide: `${REPO_URL}/blob/main/GUIDE.md`,
  terms: `${REPO_URL}#terms-of-use`,
  releases: `${REPO_URL}/releases/latest`,
} as const
