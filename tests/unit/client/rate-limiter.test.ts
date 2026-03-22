import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../../../src/client/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  const mockHeaders = (overrides: Record<string, string> = {}) => {
    return new Headers(overrides);
  };

  describe('canCall', () => {
    it('should allow calls when under limit', () => {
      expect(limiter.canCall('GET /v2/userinfo')).toBe(true);
    });

    it('should block calls when at limit', () => {
      const endpoint = 'GET /v2/test';
      // Simulate hitting the rate limit
      for (let i = 0; i < 80; i++) {
        limiter.track(endpoint, 200, mockHeaders());
      }
      expect(limiter.canCall(endpoint)).toBe(false);
    });
  });

  describe('track', () => {
    it('should update usage count on each call', () => {
      const endpoint = 'POST /v2/posts';
      limiter.track(endpoint, 200, mockHeaders());
      limiter.track(endpoint, 200, mockHeaders());

      const info = limiter.getInfo(endpoint);
      expect(info.used).toBe(2);
    });

    it('should learn limits from response headers', () => {
      const endpoint = 'GET /v2/userinfo';
      limiter.track(
        endpoint,
        200,
        mockHeaders({
          'x-ratelimit-limit': '500',
          'x-ratelimit-remaining': '498',
        }),
      );

      const info = limiter.getInfo(endpoint);
      expect(info.limit).toBe(500);
      expect(info.used).toBe(2); // 500 - 498
    });

    it('should adjust limit on 429 response', () => {
      const endpoint = 'POST /v2/posts';
      // Make some calls first
      for (let i = 0; i < 5; i++) {
        limiter.track(endpoint, 200, mockHeaders());
      }
      // Simulate a 429
      limiter.track(endpoint, 429, mockHeaders({ 'retry-after': '60' }));

      const info = limiter.getInfo(endpoint);
      expect(info.limit).toBeLessThanOrEqual(6); // Should be reduced
    });
  });

  describe('getDelay', () => {
    it('should return 0 when under limit', () => {
      expect(limiter.getDelay('GET /v2/userinfo')).toBe(0);
    });
  });

  describe('getBackoffDelay', () => {
    it('should increase exponentially', () => {
      const d0 = limiter.getBackoffDelay(0);
      const d1 = limiter.getBackoffDelay(1);
      const d2 = limiter.getBackoffDelay(2);

      // Each should be roughly double (with jitter)
      expect(d1).toBeGreaterThan(d0);
      expect(d2).toBeGreaterThan(d1);
    });

    it('should cap at 60 seconds', () => {
      const delay = limiter.getBackoffDelay(100);
      expect(delay).toBeLessThanOrEqual(60500); // 60000 + max jitter
    });
  });

  describe('getAllInfo', () => {
    it('should return info for all tracked endpoints', () => {
      limiter.track('GET /v2/userinfo', 200, mockHeaders());
      limiter.track('POST /v2/posts', 201, mockHeaders());

      const allInfo = limiter.getAllInfo();
      expect(allInfo).toHaveLength(2);
      expect(allInfo.map((i) => i.endpoint)).toContain('GET /v2/userinfo');
      expect(allInfo.map((i) => i.endpoint)).toContain('POST /v2/posts');
    });

    it('should return empty array when no calls made', () => {
      expect(limiter.getAllInfo()).toEqual([]);
    });
  });
});
