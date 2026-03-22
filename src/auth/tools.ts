/**
 * Auth tools - Always registered. Provides MCP tools for OAuth flow management.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { OAuth2Manager } from './oauth2.js';
import type { CapabilityDetector } from '../capabilities/detector.js';
import { SELF_SERVE_SCOPES } from '../types/index.js';

export function registerAuthTools(
  server: McpServer,
  authManager: OAuth2Manager,
  capabilityDetector: CapabilityDetector,
  currentUserId: () => string | null,
): void {
  server.tool(
    'linkedin_auth_start',
    'Start the LinkedIn OAuth authentication flow. Returns a URL the user must open in their browser to authorize the application.',
    {
      scopes: z
        .array(z.string())
        .optional()
        .describe(
          'OAuth scopes to request. Defaults to self-serve scopes (openid, profile, email, w_member_social). Additional scopes require LinkedIn app approval.',
        ),
    },
    async ({ scopes }) => {
      try {
        const effectiveScopes = scopes ?? [...SELF_SERVE_SCOPES];
        const { authorizationUrl, state } = authManager.getAuthorizationUrl(effectiveScopes as never);

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                'LinkedIn Authentication Required',
                '',
                'Please open this URL in your browser to authorize:',
                '',
                authorizationUrl,
                '',
                `State: ${state}`,
                '',
                'After authorizing, LinkedIn will redirect to your callback URL.',
                'Use linkedin_auth_callback with the code and state from the redirect URL.',
              ].join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to start auth flow: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_auth_callback',
    'Complete the LinkedIn OAuth flow by providing the authorization code and state from the callback URL.',
    {
      code: z.string().describe('Authorization code from LinkedIn callback URL'),
      state: z.string().describe('State parameter from LinkedIn callback URL'),
    },
    async ({ code, state }) => {
      try {
        const token = await authManager.handleCallback(code, state);
        const modules = capabilityDetector.detect(token.scopes);
        const summary = capabilityDetector.getSummary(modules);

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                'Authentication successful!',
                '',
                `User ID: ${token.userId}`,
                `Scopes granted: ${token.scopes.join(', ')}`,
                `Token expires: ${new Date(token.expiresAt).toISOString()}`,
                '',
                summary,
                '',
                'You can now use LinkedIn tools. The server will need to be restarted',
                'to register tools for newly available modules.',
              ].join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_auth_logout',
    'Revoke the LinkedIn access token and log out.',
    {},
    async () => {
      try {
        const userId = currentUserId();
        if (!userId) {
          return {
            content: [
              { type: 'text' as const, text: 'Not currently authenticated.' },
            ],
          };
        }

        await authManager.revokeToken(userId);

        return {
          content: [
            {
              type: 'text' as const,
              text: 'Successfully logged out. Token has been revoked.',
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Logout failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
