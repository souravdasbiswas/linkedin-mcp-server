/**
 * Adaptive rate limiter for LinkedIn API.
 * Tracks usage per endpoint using response headers and learned limits from 429s.
 * LinkedIn rate limits are per 24-hour window, resetting at midnight UTC.
 */

export interface RateLimitInfo {
  endpoint: string;
  used: number;
  limit: number;
  resetAt: number; // Unix timestamp ms
}

interface EndpointBucket {
  used: number;
  limit: number; // Learned from headers or 429s; starts conservative
  resetAt: number;
  lastUpdated: number;
}

const DEFAULT_LIMIT = 80; // Conservative default until we learn actual limits
const BACKOFF_BASE_MS = 1000;

export class RateLimiter {
  private buckets = new Map<string, EndpointBucket>();

  /**
   * Track a response to update rate limit counters.
   * Extracts limits from LinkedIn response headers when available.
   */
  track(endpoint: string, status: number, headers: Headers): void {
    const bucket = this.getOrCreateBucket(endpoint);
    bucket.used++;
    bucket.lastUpdated = Date.now();

    // LinkedIn sometimes sends rate limit headers
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (limit) {
      bucket.limit = parseInt(limit, 10);
    }
    if (remaining !== null) {
      // Adjust used count based on actual remaining
      bucket.used = bucket.limit - parseInt(remaining, 10);
    }
    if (reset) {
      bucket.resetAt = parseInt(reset, 10) * 1000; // Convert to ms
    }

    // If we got a 429, reduce our limit estimate
    if (status === 429) {
      bucket.limit = Math.max(1, bucket.used - 1);
      const retryAfter = headers.get('retry-after');
      if (retryAfter) {
        bucket.resetAt = Date.now() + parseInt(retryAfter, 10) * 1000;
      }
    }
  }

  /**
   * Check if we can make a call to this endpoint.
   */
  canCall(endpoint: string): boolean {
    const bucket = this.getOrCreateBucket(endpoint);
    this.resetIfExpired(bucket);
    return bucket.used < bucket.limit;
  }

  /**
   * Get current rate limit info for an endpoint.
   */
  getInfo(endpoint: string): RateLimitInfo {
    const bucket = this.getOrCreateBucket(endpoint);
    this.resetIfExpired(bucket);
    return {
      endpoint,
      used: bucket.used,
      limit: bucket.limit,
      resetAt: bucket.resetAt,
    };
  }

  /**
   * Get rate limit info for all tracked endpoints.
   */
  getAllInfo(): RateLimitInfo[] {
    return Array.from(this.buckets.entries()).map(([endpoint, bucket]) => {
      this.resetIfExpired(bucket);
      return {
        endpoint,
        used: bucket.used,
        limit: bucket.limit,
        resetAt: bucket.resetAt,
      };
    });
  }

  /**
   * Calculate delay (ms) if we need to wait before calling.
   * Returns 0 if we can call immediately.
   */
  getDelay(endpoint: string): number {
    const bucket = this.getOrCreateBucket(endpoint);
    this.resetIfExpired(bucket);

    if (bucket.used < bucket.limit) return 0;
    return Math.max(0, bucket.resetAt - Date.now());
  }

  /**
   * Wait if necessary before making a call.
   */
  async waitIfNeeded(endpoint: string): Promise<void> {
    const delay = this.getDelay(endpoint);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Get exponential backoff delay for retries.
   */
  getBackoffDelay(attempt: number): number {
    const jitter = Math.random() * 500;
    return Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt) + jitter, 60000);
  }

  private getOrCreateBucket(endpoint: string): EndpointBucket {
    let bucket = this.buckets.get(endpoint);
    if (!bucket) {
      bucket = {
        used: 0,
        limit: DEFAULT_LIMIT,
        resetAt: this.getNextMidnightUtc(),
        lastUpdated: Date.now(),
      };
      this.buckets.set(endpoint, bucket);
    }
    return bucket;
  }

  private resetIfExpired(bucket: EndpointBucket): void {
    if (Date.now() >= bucket.resetAt) {
      bucket.used = 0;
      bucket.resetAt = this.getNextMidnightUtc();
    }
  }

  private getNextMidnightUtc(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0,
    ));
    return midnight.getTime();
  }
}
