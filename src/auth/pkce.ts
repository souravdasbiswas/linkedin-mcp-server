/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 * Generates cryptographically secure code verifier and challenge pairs.
 */

import { randomBytes, createHash } from 'node:crypto';

export interface PkceChallenge {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/**
 * Generate a PKCE code verifier - a random string of 43-128 characters.
 * Uses URL-safe base64 encoding per RFC 7636.
 */
export function generateCodeVerifier(length = 64): string {
  const bytes = randomBytes(length);
  return bytes.toString('base64url').slice(0, length);
}

/**
 * Generate the S256 code challenge from a code verifier.
 * challenge = BASE64URL(SHA256(verifier))
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a complete PKCE challenge pair.
 */
export function generatePkceChallenge(): PkceChallenge {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256',
  };
}
