/**
 * Server configuration types.
 */

import type { LinkedInScope } from './linkedin.js';

export interface ServerConfig {
  linkedin: LinkedInConfig;
  server: McpServerConfig;
  storage: StorageConfig;
}

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: LinkedInScope[];
  apiBaseUrl: string;
  authBaseUrl: string;
}

export interface McpServerConfig {
  name: string;
  version: string;
  transport: 'stdio';
}

export interface StorageConfig {
  dbPath: string;
}

export const DEFAULT_CONFIG: Partial<ServerConfig> = {
  linkedin: {
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://localhost:3000/callback',
    scopes: [],
    apiBaseUrl: 'https://api.linkedin.com',
    authBaseUrl: 'https://www.linkedin.com/oauth/v2',
  },
  server: {
    name: 'linkedin-mcp-server',
    version: '0.1.0',
    transport: 'stdio',
  },
  storage: {
    dbPath: '',
  },
};
