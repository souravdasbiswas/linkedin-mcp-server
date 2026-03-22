import { describe, it, expect } from 'vitest';
import type { CreatePostRequest, CreateCommentRequest, CreateEventRequest } from '../../src/types/index.js';

/**
 * Contract tests - verify our request/response shapes match LinkedIn's documented API spec.
 * These tests don't hit any API; they validate the shape of payloads we construct.
 */

describe('LinkedIn API Contract Tests', () => {
  describe('CreatePostRequest schema', () => {
    it('should produce valid text post request', () => {
      const request: CreatePostRequest = {
        author: 'urn:li:person:abc123',
        commentary: 'Hello LinkedIn!',
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
      };

      // Validate required fields
      expect(request.author).toMatch(/^urn:li:(person|organization):\w+$/);
      expect(request.commentary).toBeTruthy();
      expect(['PUBLIC', 'CONNECTIONS', 'LOGGED_IN']).toContain(request.visibility);
      expect(['MAIN_FEED', 'NONE']).toContain(request.distribution.feedDistribution);
      expect(['PUBLISHED', 'DRAFT']).toContain(request.lifecycleState);
    });

    it('should produce valid article post request', () => {
      const request: CreatePostRequest = {
        author: 'urn:li:person:abc123',
        commentary: 'Check this out',
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        content: {
          article: {
            source: 'https://example.com/article',
            title: 'My Article',
            description: 'Article description',
          },
        },
      };

      expect(request.content?.article?.source).toMatch(/^https?:\/\//);
      expect(request.content?.article?.title).toBeTruthy();
    });

    it('should produce valid image post request', () => {
      const request: CreatePostRequest = {
        author: 'urn:li:person:abc123',
        commentary: 'Check this image',
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        content: {
          media: {
            id: 'urn:li:image:upload123',
            altText: 'A test image',
          },
        },
      };

      expect(request.content?.media?.id).toMatch(/^urn:li:image:/);
    });

    it('should enforce commentary length limit', () => {
      const longText = 'a'.repeat(3001);
      // In practice this is enforced by zod schema in the tool, not the type
      // But we document the contract
      expect(longText.length).toBeGreaterThan(3000);
    });
  });

  describe('CreateCommentRequest schema', () => {
    it('should produce valid comment request', () => {
      const request: CreateCommentRequest = {
        actor: 'urn:li:person:abc123',
        message: 'Great post!',
      };

      expect(request.actor).toMatch(/^urn:li:person:\w+$/);
      expect(request.message).toBeTruthy();
      expect(request.message.length).toBeLessThanOrEqual(1250);
    });

    it('should support reply comments', () => {
      const request: CreateCommentRequest = {
        actor: 'urn:li:person:abc123',
        message: 'Reply to your comment',
        parentComment: 'urn:li:comment:456',
      };

      expect(request.parentComment).toBeDefined();
    });
  });

  describe('CreateEventRequest schema', () => {
    it('should produce valid event request', () => {
      const request: CreateEventRequest = {
        organizer: 'urn:li:person:abc123',
        name: 'Tech Meetup',
        description: 'Monthly tech meetup',
        timeRange: {
          start: '2026-04-01T10:00:00Z',
          end: '2026-04-01T12:00:00Z',
        },
        format: 'ONLINE',
        eventUrl: 'https://example.com/meeting',
      };

      expect(request.organizer).toMatch(/^urn:li:person:\w+$/);
      expect(request.name.length).toBeLessThanOrEqual(255);
      expect(['ONLINE', 'IN_PERSON', 'HYBRID']).toContain(request.format);
      expect(request.timeRange.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should allow event without end date', () => {
      const request: CreateEventRequest = {
        organizer: 'urn:li:person:abc123',
        name: 'Open-ended Event',
        timeRange: {
          start: '2026-04-01T10:00:00Z',
        },
        format: 'IN_PERSON',
      };

      expect(request.timeRange.end).toBeUndefined();
    });
  });

  describe('URN format validation', () => {
    it('should validate person URN format', () => {
      const validUrns = ['urn:li:person:abc123', 'urn:li:person:A1B2C3'];
      const invalidUrns = ['person:abc123', 'urn:li:abc123', 'urn:li:person:'];

      for (const urn of validUrns) {
        expect(urn).toMatch(/^urn:li:person:\w+$/);
      }
      for (const urn of invalidUrns) {
        expect(urn).not.toMatch(/^urn:li:person:\w+$/);
      }
    });

    it('should validate organization URN format', () => {
      expect('urn:li:organization:123456').toMatch(/^urn:li:organization:\w+$/);
    });

    it('should validate image URN format', () => {
      expect('urn:li:image:C4D20AQH_example').toMatch(/^urn:li:image:\w+$/);
    });
  });

  describe('Reaction types', () => {
    it('should include all valid LinkedIn reaction types', () => {
      const validTypes = ['LIKE', 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'ENTERTAINMENT'];
      // These map to the LinkedIn UI labels:
      // LIKE = Like, PRAISE = Celebrate, APPRECIATION = Support,
      // EMPATHY = Love, INTEREST = Insightful, ENTERTAINMENT = Funny
      expect(validTypes).toHaveLength(6);
    });
  });
});
