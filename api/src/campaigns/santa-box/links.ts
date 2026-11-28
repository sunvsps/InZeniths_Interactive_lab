// Box links: <app>/box-<slug> for every box, or <app>/<name>-<code> once a paying sender has named it.
import { randomSlug } from '../../lib/tokens.js';

/** SANTA_APP_URL may include a path (https://inzeniths.com/santa), so links are joined onto it rather than resolved from the site root. */
export const appHome = (appUrl: string) => appUrl.replace(/\/+$/, '') + '/';
export const giftLink = (appUrl: string, gift: { slug: string; alias: string | null }) => `${appHome(appUrl)}${gift.alias ?? `box-${gift.slug}`}`;

export const ALIAS_MIN = 3;
export const ALIAS_MAX = 30;
/** Random characters added after the chosen name, so a link like sun-to-mom cannot be guessed. */
export const ALIAS_CODE_LENGTH = 4;

/**
 * What the sender typed → the name used in the link ("Sun to Mom" → "sun-to-mom"), or null if it cannot be used.
 * Names starting with "box-" are refused: that is how the ordinary links look.
 */
export function aliasName(input: string): string | null {
  const name = input.trim().toLowerCase().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (name.length < ALIAS_MIN || name.length > ALIAS_MAX) return null;
  if (!/^[a-z0-9-]+$/.test(name) || name === 'box' || name.startsWith('box-')) return null;
  return name;
}

export const newAlias = (name: string) => `${name}-${randomSlug(ALIAS_CODE_LENGTH)}`;
