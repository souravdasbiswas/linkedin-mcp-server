import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, generatePkceChallenge } from '../../../src/auth/pkce.js';
import { createHash } from 'node:crypto';

describe('PKCE', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a string of the specified length', () => {
      const verifier = generateCodeVerifier(64);
      expect(verifier).toHaveLength(64);
    });

    it('should generate URL-safe base64 characters only', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate unique values each time', () => {
      const v1 = generateCodeVerifier();
      const v2 = generateCodeVerifier();
      expect(v1).not.toBe(v2);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should produce a valid S256 challenge from a verifier', () => {
      const verifier = 'test-verifier-string';
      const challenge = generateCodeChallenge(verifier);

      // Manually compute the expected challenge
      const expected = createHash('sha256').update(verifier).digest('base64url');
      expect(challenge).toBe(expected);
    });

    it('should produce different challenges for different verifiers', () => {
      const c1 = generateCodeChallenge('verifier-1');
      const c2 = generateCodeChallenge('verifier-2');
      expect(c1).not.toBe(c2);
    });
  });

  describe('generatePkceChallenge', () => {
    it('should return a complete PKCE challenge pair', () => {
      const pkce = generatePkceChallenge();

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(pkce.codeChallengeMethod).toBe('S256');
    });

    it('should produce a challenge that matches the verifier', () => {
      const pkce = generatePkceChallenge();
      const expectedChallenge = createHash('sha256')
        .update(pkce.codeVerifier)
        .digest('base64url');
      expect(pkce.codeChallenge).toBe(expectedChallenge);
    });
  });
});
