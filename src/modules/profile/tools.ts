/**
 * Profile module - Self-serve tools for reading authenticated user's profile.
 * Scopes required: openid, profile, email
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LinkedInApiClient } from '../../client/api-client.js';
import type { UserInfo } from '../../types/index.js';

export function registerProfileTools(server: McpServer, apiClient: LinkedInApiClient): void {
  server.tool(
    'linkedin_get_my_profile',
    'Get the authenticated LinkedIn user\'s profile including name, headline, and profile picture URL.',
    {},
    async () => {
      try {
        const userInfo = await apiClient.get<UserInfo>('/v2/userinfo', false);

        const profile = {
          id: userInfo.sub,
          name: userInfo.name,
          givenName: userInfo.given_name,
          familyName: userInfo.family_name,
          picture: userInfo.picture,
          email: userInfo.email,
          emailVerified: userInfo.email_verified,
          locale: userInfo.locale,
        };

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(profile, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get profile: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_get_my_email',
    'Get the authenticated LinkedIn user\'s email address.',
    {},
    async () => {
      try {
        const userInfo = await apiClient.get<UserInfo>('/v2/userinfo', false);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  email: userInfo.email,
                  emailVerified: userInfo.email_verified,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get email: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_get_auth_status',
    'Check the current LinkedIn authentication status, granted scopes, and token expiry.',
    {},
    async () => {
      try {
        // A simple check - if we can call userinfo, we're authenticated
        const userInfo = await apiClient.get<UserInfo>('/v2/userinfo', false);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  authenticated: true,
                  userId: userInfo.sub,
                  name: userInfo.name,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  authenticated: false,
                  error: error instanceof Error ? error.message : String(error),
                  hint: 'Use linkedin_auth_start to authenticate.',
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  );

  server.tool(
    'linkedin_get_rate_limits',
    'Get current rate limit usage for all LinkedIn API endpoints that have been called.',
    {},
    async () => {
      const limits = apiClient.getRateLimitInfo();

      if (limits.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No API calls have been made yet. Rate limit data will be available after the first API call.',
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              limits.map((l) => ({
                endpoint: l.endpoint,
                used: l.used,
                limit: l.limit,
                resetAt: new Date(l.resetAt).toISOString(),
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
