/**
 * Capability detection module.
 * Dynamically determines which MCP tools to register based on the
 * OAuth scopes the user has granted. This ensures users only see
 * tools they can actually use.
 */

import { LINKEDIN_SCOPES } from '../types/index.js';

export interface EnabledModules {
  auth: boolean; // Always enabled - needed to start auth flow
  profile: boolean;
  posting: boolean;
  events: boolean;
  organizationManagement: boolean;
  advertising: boolean;
  analytics: boolean;
}

/**
 * Map of modules to required scopes.
 * A module is enabled when ALL of its required scopes are granted.
 */
const MODULE_SCOPE_REQUIREMENTS: Record<keyof Omit<EnabledModules, 'auth'>, string[]> = {
  profile: [LINKEDIN_SCOPES.OPENID, LINKEDIN_SCOPES.PROFILE],
  posting: [LINKEDIN_SCOPES.MEMBER_SOCIAL_WRITE],
  events: [LINKEDIN_SCOPES.MEMBER_SOCIAL_WRITE],
  organizationManagement: [LINKEDIN_SCOPES.ORG_SOCIAL_READ],
  advertising: [LINKEDIN_SCOPES.ADS_READ],
  analytics: [LINKEDIN_SCOPES.MEMBER_POST_ANALYTICS],
};

export class CapabilityDetector {
  /**
   * Detect which modules should be enabled based on granted scopes.
   */
  detect(grantedScopes: string[]): EnabledModules {
    const scopeSet = new Set(grantedScopes);

    const modules: EnabledModules = {
      auth: true, // Always available
      profile: false,
      posting: false,
      events: false,
      organizationManagement: false,
      advertising: false,
      analytics: false,
    };

    for (const [moduleName, requiredScopes] of Object.entries(MODULE_SCOPE_REQUIREMENTS)) {
      modules[moduleName as keyof Omit<EnabledModules, 'auth'>] =
        requiredScopes.every((scope) => scopeSet.has(scope));
    }

    return modules;
  }

  /**
   * Get a human-readable summary of enabled/disabled modules.
   */
  getSummary(modules: EnabledModules): string {
    const lines: string[] = ['LinkedIn MCP Server - Available Modules:', ''];

    for (const [name, enabled] of Object.entries(modules)) {
      const status = enabled ? '[enabled]' : '[disabled - missing required scopes]';
      lines.push(`  ${name}: ${status}`);
    }

    const disabledModules = Object.entries(modules)
      .filter(([, enabled]) => !enabled)
      .map(([name]) => name);

    if (disabledModules.length > 0) {
      lines.push('');
      lines.push('To enable more modules, re-authenticate with additional scopes.');
      lines.push('Some scopes require LinkedIn Developer App approval.');
    }

    return lines.join('\n');
  }

  /**
   * Get the scopes needed to enable a specific module.
   */
  getRequiredScopes(moduleName: keyof Omit<EnabledModules, 'auth'>): string[] {
    return MODULE_SCOPE_REQUIREMENTS[moduleName] ?? [];
  }

  /**
   * Get all scopes for all self-serve modules (no approval needed).
   */
  getSelfServeScopes(): string[] {
    return [
      LINKEDIN_SCOPES.OPENID,
      LINKEDIN_SCOPES.PROFILE,
      LINKEDIN_SCOPES.EMAIL,
      LINKEDIN_SCOPES.MEMBER_SOCIAL_WRITE,
    ];
  }
}
