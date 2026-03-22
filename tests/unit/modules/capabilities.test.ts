import { describe, it, expect } from 'vitest';
import { CapabilityDetector } from '../../../src/capabilities/detector.js';

describe('CapabilityDetector', () => {
  const detector = new CapabilityDetector();

  describe('detect', () => {
    it('should enable auth module with no scopes', () => {
      const modules = detector.detect([]);
      expect(modules.auth).toBe(true);
    });

    it('should enable profile with openid + profile scopes', () => {
      const modules = detector.detect(['openid', 'profile']);
      expect(modules.profile).toBe(true);
      expect(modules.posting).toBe(false);
    });

    it('should enable posting with w_member_social scope', () => {
      const modules = detector.detect(['w_member_social']);
      expect(modules.posting).toBe(true);
      expect(modules.events).toBe(true); // Same scope
    });

    it('should enable all self-serve modules with full self-serve scopes', () => {
      const modules = detector.detect(['openid', 'profile', 'email', 'w_member_social']);
      expect(modules.auth).toBe(true);
      expect(modules.profile).toBe(true);
      expect(modules.posting).toBe(true);
      expect(modules.events).toBe(true);
      // Vetted modules should still be disabled
      expect(modules.organizationManagement).toBe(false);
      expect(modules.advertising).toBe(false);
      expect(modules.analytics).toBe(false);
    });

    it('should enable org management with r_organization_social', () => {
      const modules = detector.detect(['r_organization_social']);
      expect(modules.organizationManagement).toBe(true);
    });

    it('should enable advertising with r_ads', () => {
      const modules = detector.detect(['r_ads']);
      expect(modules.advertising).toBe(true);
    });

    it('should require ALL scopes for a module, not just one', () => {
      // Profile requires BOTH openid AND profile
      const modules = detector.detect(['openid']);
      expect(modules.profile).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should list all modules with their status', () => {
      const modules = detector.detect(['openid', 'profile', 'w_member_social']);
      const summary = detector.getSummary(modules);

      expect(summary).toContain('auth: [enabled]');
      expect(summary).toContain('profile: [enabled]');
      expect(summary).toContain('posting: [enabled]');
      expect(summary).toContain('advertising: [disabled');
    });
  });

  describe('getSelfServeScopes', () => {
    it('should return the four self-serve scopes', () => {
      const scopes = detector.getSelfServeScopes();
      expect(scopes).toContain('openid');
      expect(scopes).toContain('profile');
      expect(scopes).toContain('email');
      expect(scopes).toContain('w_member_social');
      expect(scopes).toHaveLength(4);
    });
  });

  describe('getRequiredScopes', () => {
    it('should return correct scopes for each module', () => {
      expect(detector.getRequiredScopes('profile')).toEqual(['openid', 'profile']);
      expect(detector.getRequiredScopes('posting')).toEqual(['w_member_social']);
      expect(detector.getRequiredScopes('advertising')).toEqual(['r_ads']);
    });
  });
});
