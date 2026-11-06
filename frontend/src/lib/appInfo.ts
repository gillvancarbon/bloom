/**
 * App metadata and the public links shown on the About screen and in Settings.
 * Keep `APP_VERSION` in step with package.json and the Android versionName.
 */

export const APP_VERSION = '1.3.0'

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
