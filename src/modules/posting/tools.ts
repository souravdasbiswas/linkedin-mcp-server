/**
 * Posting module - Self-serve tools for creating and managing LinkedIn posts.
 * Scope required: w_member_social
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LinkedInApiClient } from '../../client/api-client.js';
import type {
  CreatePostRequest,
  Post,
  CreateCommentRequest,
  PostVisibility,
  ReactionType,
  InitializeUploadResponse,
} from '../../types/index.js';

export function registerPostingTools(
  server: McpServer,
  apiClient: LinkedInApiClient,
  getUserId: () => Promise<string>,
): void {
  server.tool(
    'linkedin_create_post',
    'Create a new LinkedIn post. Supports text posts and posts with article links. Use linkedin_upload_image first if you want to attach an image.',
    {
      text: z.string().min(1).max(3000).describe('The post text content (max 3000 characters)'),
      visibility: z
        .enum(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN'])
        .default('PUBLIC')
        .describe('Post visibility: PUBLIC (anyone), CONNECTIONS (1st degree), LOGGED_IN (LinkedIn members only)'),
      articleUrl: z
        .string()
        .url()
        .optional()
        .describe('Optional URL to share as an article attachment'),
      articleTitle: z.string().optional().describe('Title for the article attachment'),
      articleDescription: z.string().optional().describe('Description for the article attachment'),
      imageUrn: z
        .string()
        .optional()
        .describe('Image URN from linkedin_upload_image to attach to the post'),
      imageAltText: z.string().optional().describe('Alt text for the attached image'),
    },
    async ({ text, visibility, articleUrl, articleTitle, articleDescription, imageUrn, imageAltText }) => {
      try {
        const userId = await getUserId();
        const authorUrn = `urn:li:person:${userId}` as const;

        const postRequest: CreatePostRequest = {
          author: authorUrn,
          commentary: text,
          visibility: visibility as PostVisibility,
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
        };

        // Add article content if provided
        if (articleUrl) {
          postRequest.content = {
            article: {
              source: articleUrl,
              title: articleTitle,
              description: articleDescription,
            },
          };
        }

        // Add image content if provided
        if (imageUrn) {
          postRequest.content = {
            media: {
              id: imageUrn as `urn:li:image:${string}`,
              altText: imageAltText,
            },
          };
        }

        const result = await apiClient.post<{ id: string }>('/v2/posts', postRequest);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  postUrn: result?.id ?? 'Post created (URN in response header)',
                  visibility,
                  message: 'Post published successfully to LinkedIn.',
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
              text: `Failed to create post: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_delete_post',
    'Delete a LinkedIn post by its URN. You can only delete your own posts.',
    {
      postUrn: z.string().describe('The URN of the post to delete (e.g., urn:li:share:123456)'),
    },
    async ({ postUrn }) => {
      try {
        const encodedUrn = encodeURIComponent(postUrn);
        await apiClient.delete(`/v2/posts/${encodedUrn}`);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { success: true, message: `Post ${postUrn} deleted successfully.` },
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
              text: `Failed to delete post: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_create_comment',
    'Comment on a LinkedIn post.',
    {
      postUrn: z.string().describe('The URN of the post to comment on'),
      text: z.string().min(1).max(1250).describe('Comment text (max 1250 characters)'),
      parentCommentUrn: z
        .string()
        .optional()
        .describe('URN of parent comment for a reply (optional)'),
    },
    async ({ postUrn, text, parentCommentUrn }) => {
      try {
        const userId = await getUserId();
        const actorUrn = `urn:li:person:${userId}` as const;
        const encodedPostUrn = encodeURIComponent(postUrn);

        const commentRequest: CreateCommentRequest = {
          actor: actorUrn,
          message: text,
          parentComment: parentCommentUrn as `urn:li:${string}:${string}` | undefined,
        };

        const result = await apiClient.post<{ id: string }>(
          `/v2/socialActions/${encodedPostUrn}/comments`,
          commentRequest,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  commentId: result?.id,
                  message: 'Comment posted successfully.',
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
              text: `Failed to create comment: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_react_to_post',
    'React to a LinkedIn post (like, celebrate, support, love, insightful, funny).',
    {
      postUrn: z.string().describe('The URN of the post to react to'),
      reactionType: z
        .enum(['LIKE', 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'ENTERTAINMENT'])
        .describe(
          'Reaction type: LIKE, PRAISE (celebrate), APPRECIATION (support), EMPATHY (love), INTEREST (insightful), ENTERTAINMENT (funny)',
        ),
    },
    async ({ postUrn, reactionType }) => {
      try {
        const userId = await getUserId();
        const actorUrn = `urn:li:person:${userId}`;
        const encodedPostUrn = encodeURIComponent(postUrn);

        await apiClient.post(`/v2/socialActions/${encodedPostUrn}/likes`, {
          actor: actorUrn,
          reactionType: reactionType as ReactionType,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  message: `Reacted with ${reactionType} to post.`,
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
              text: `Failed to react: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.tool(
    'linkedin_upload_image',
    'Upload an image for use in a LinkedIn post. Returns an image URN to use with linkedin_create_post.',
    {
      imagePath: z.string().describe('Absolute path to the image file on disk'),
      altText: z.string().optional().describe('Alt text description of the image'),
    },
    async ({ imagePath }) => {
      try {
        const { readFile } = await import('node:fs/promises');
        const { extname } = await import('node:path');

        const userId = await getUserId();
        const ownerUrn = `urn:li:person:${userId}`;

        // Step 1: Initialize the upload
        const initResponse = await apiClient.post<InitializeUploadResponse>(
          '/v2/images?action=initializeUpload',
          {
            initializeUploadRequest: { owner: ownerUrn },
          },
        );

        const { uploadUrl, image: imageUrn } = initResponse.value;

        // Step 2: Upload the binary data
        const imageData = await readFile(imagePath);
        const ext = extname(imagePath).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
        };
        const contentType = contentTypeMap[ext] ?? 'image/jpeg';

        await apiClient.uploadBinary(uploadUrl, imageData, contentType);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  imageUrn,
                  message:
                    'Image uploaded. Use the imageUrn with linkedin_create_post to attach it to a post.',
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
              text: `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
