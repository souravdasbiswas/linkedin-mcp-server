/**
 * LinkedIn MCP Server - Core server setup.
 * Wires together auth, API client, capability detection, and tool modules.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { OAuth2Manager } from './auth/oauth2.js';
import { TokenStore } from './auth/token-store.js';
import { registerAuthTools } from './auth/tools.js';
import { LinkedInApiClient } from './client/api-client.js';
import { CapabilityDetector } from './capabilities/detector.js';
import { registerProfileTools } from './modules/profile/tools.js';
import { registerPostingTools } from './modules/posting/tools.js';
import { registerEventTools } from './modules/events/tools.js';
import type { ServerConfig } from './types/index.js';

export interface ServerDependencies {
  config: ServerConfig;
  tokenStore?: TokenStore;
}

export function createLinkedInMcpServer(deps: ServerDependencies) {
  const { config } = deps;

  // Initialize persistence
  const tokenStore = deps.tokenStore ?? new TokenStore(config.storage.dbPath);

  // Initialize auth
  const authManager = new OAuth2Manager(config.linkedin, tokenStore);

  // Initialize capability detection
  const capabilityDetector = new CapabilityDetector();

  // Track current user ID - set when a token exists
  let currentUserId: string | null = null;

  // Check for existing token
  // The token store uses user ID as key; we try to find one
  // In a multi-user scenario, this would be session-based
  const findExistingUser = (): string | null => {
    // For stdio (single-user), we use a sentinel key to find any stored user
    // This gets set properly after auth callback
    return currentUserId;
  };

  // Initialize API client
  const apiClient = new LinkedInApiClient({
    baseUrl: config.linkedin.apiBaseUrl,
    getAccessToken: async () => {
      const userId = findExistingUser();
      if (!userId) {
        throw new Error('Not authenticated. Use linkedin_auth_start first.');
      }
      return authManager.getAccessToken(userId);
    },
  });

  // Helper to get user ID for tools
  const getUserId = async (): Promise<string> => {
    const userId = findExistingUser();
    if (!userId) {
      throw new Error('Not authenticated. Use linkedin_auth_start first.');
    }
    return userId;
  };

  // Create MCP server
  const server = new McpServer({
    name: config.server.name,
    version: config.server.version,
  });

  // Always register auth tools
  registerAuthTools(server, authManager, capabilityDetector, () => currentUserId);

  // Detect capabilities and register appropriate modules
  const grantedScopes = currentUserId ? authManager.getGrantedScopes(currentUserId) : [];
  const modules = capabilityDetector.detect(grantedScopes);

  // For self-serve mode, register all self-serve tools
  // They will return auth errors if not authenticated yet
  // This is better UX than hiding tools - user can see what's available
  registerProfileTools(server, apiClient);
  registerPostingTools(server, apiClient, getUserId);
  registerEventTools(server, apiClient, getUserId);

  // Return server and a way to update the user ID after auth
  return {
    server,
    setCurrentUserId: (userId: string) => {
      currentUserId = userId;
    },
    getCapabilities: () => {
      const scopes = currentUserId ? authManager.getGrantedScopes(currentUserId) : [];
      return capabilityDetector.detect(scopes);
    },
    close: () => {
      tokenStore.close();
    },
  };
}
