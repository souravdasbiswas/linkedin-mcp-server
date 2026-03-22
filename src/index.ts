#!/usr/bin/env node

/**
 * LinkedIn MCP Server - Entry point.
 * Starts the server with stdio transport for local CLI use.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';
import { createLinkedInMcpServer } from './server.js';
import type { ServerConfig } from './types/index.js';
import { SELF_SERVE_SCOPES } from './types/index.js';

function getConfig(): ServerConfig {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      'Error: LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables are required.',
    );
    console.error('');
    console.error('Set them in your MCP client configuration:');
    console.error('  LINKEDIN_CLIENT_ID=your_client_id');
    console.error('  LINKEDIN_CLIENT_SECRET=your_client_secret');
    process.exit(1);
  }

  // Ensure data directory exists
  const dataDir = process.env.LINKEDIN_MCP_DATA_DIR ?? join(homedir(), '.linkedin-mcp');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return {
    linkedin: {
      clientId,
      clientSecret,
      redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? 'http://localhost:3000/callback',
      scopes: SELF_SERVE_SCOPES,
      apiBaseUrl: process.env.LINKEDIN_API_BASE_URL ?? 'https://api.linkedin.com',
      authBaseUrl: process.env.LINKEDIN_AUTH_BASE_URL ?? 'https://www.linkedin.com/oauth/v2',
    },
    server: {
      name: 'linkedin-mcp-server',
      version: '0.1.0',
      transport: 'stdio',
    },
    storage: {
      dbPath: join(dataDir, 'tokens.db'),
    },
  };
}

async function main() {
  const config = getConfig();
  const { server } = createLinkedInMcpServer({ config });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Handle graceful shutdown
  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
