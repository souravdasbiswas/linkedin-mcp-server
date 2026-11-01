import { describe, it, expect } from 'vitest';
import { escapeLittleText } from '../../../src/utils/little-text.js';

describe('escapeLittleText', () => {
  it('leaves plain text untouched', () => {
    const text = 'Hola, esto es una prueba sin caracteres reservados.';
    expect(escapeLittleText(text)).toBe(text);
  });

  it('escapes parentheses, the characters that silently truncate posts', () => {
    expect(escapeLittleText('la familia Claude (Sonnet, Haiku, Opus)')).toBe(
      'la familia Claude \\(Sonnet, Haiku, Opus\\)',
    );
  });

  it('escapes every reserved character', () => {
    const reserved = ['\\', '|', '(', ')', '[', ']', '{', '}', '<', '>', '@', '*', '_', '~'];
    const escaped = reserved.map((character) => `\\${character}`).join('');
    expect(escapeLittleText(reserved.join(''))).toBe(escaped);
  });

  it('keeps hashtags readable so LinkedIn can still linkify them', () => {
    expect(escapeLittleText('#IA #OpenCode #frIAkeando')).toBe('#IA #OpenCode #frIAkeando');
  });

  it('escapes backslashes so they cannot start an escape sequence', () => {
    expect(escapeLittleText('a\\b')).toBe('a\\\\b');
  });

  it('preserves newlines and non-ASCII characters', () => {
    const text = 'Línea uno\n\nLínea dos: 9,5 € — ¿ok?';
    expect(escapeLittleText(text)).toBe(text);
  });
});
