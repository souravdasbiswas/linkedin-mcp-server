/**
 * LinkedIn's Posts API parses `commentary` as "little text", a lightweight
 * markup where a set of characters is reserved. Unescaped reserved characters
 * are interpreted as markup: the request still returns 201 with a valid URN,
 * but the post is silently truncated at the first unescaped parenthesis.
 *
 * Known reports:
 * - https://stackoverflow.com/questions/73712703
 * - https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
 *
 * `#` is intentionally left alone so hashtags keep working: LinkedIn detects
 * them in plain commentary and renders them as links.
 */
const RESERVED_CHARACTERS = /[\\|()[\]{}<>@*_~]/g;

/**
 * Escapes the characters LinkedIn reserves in the little-text format so they
 * are rendered as plain text instead of being parsed as markup.
 */
export function escapeLittleText(text: string): string {
  return text.replace(RESERVED_CHARACTERS, (character) => `\\${character}`);
}
