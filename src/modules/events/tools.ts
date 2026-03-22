/**
 * Events module - Self-serve tools for creating and managing LinkedIn events.
 * Scope required: w_member_social
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LinkedInApiClient } from '../../client/api-client.js';
import type { CreateEventRequest, LinkedInEvent } from '../../types/index.js';

export function registerEventTools(
  server: McpServer,
  apiClient: LinkedInApiClient,
  getUserId: () => Promise<string>,
): void {
  server.tool(
    'linkedin_create_event',
    'Create a LinkedIn event. Supports online, in-person, and hybrid formats.',
    {
      name: z.string().min(1).max(255).describe('Event name'),
      description: z.string().max(5000).optional().describe('Event description (max 5000 chars)'),
      startDate: z
        .string()
        .describe('Event start date/time in ISO 8601 format (e.g., 2026-04-01T10:00:00Z)'),
      endDate: z
        .string()
        .optional()
        .describe('Event end date/time in ISO 8601 format'),
      format: z
        .enum(['ONLINE', 'IN_PERSON', 'HYBRID'])
        .default('ONLINE')
        .describe('Event format'),
      eventUrl: z
        .string()
        .url()
        .optional()
        .describe('URL for the event (e.g., meeting link for online events)'),
    },
    async ({ name, description, startDate, endDate, format, eventUrl }) => {
      try {
        const userId = await getUserId();
        const organizerUrn = `urn:li:person:${userId}` as const;

        const eventRequest: CreateEventRequest = {
          organizer: organizerUrn,
          name,
          description,
          eventUrl,
          timeRange: {
            start: startDate,
            end: endDate,
          },
          format: format as 'ONLINE' | 'IN_PERSON' | 'HYBRID',
        };

        const result = await apiClient.post<{ id: string }>('/v2/events', eventRequest);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  eventId: result?.id,
                  message: `Event "${name}" created successfully.`,
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
              text: `Failed to create event: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_get_event',
    'Get details of a LinkedIn event by its ID.',
    {
      eventId: z.string().describe('The event ID or URN'),
    },
    async ({ eventId }) => {
      try {
        const encodedId = encodeURIComponent(eventId);
        const event = await apiClient.get<LinkedInEvent>(`/v2/events/${encodedId}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(event, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to get event: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
