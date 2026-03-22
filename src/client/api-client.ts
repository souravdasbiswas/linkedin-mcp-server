/**
 * Core LinkedIn API HTTP client.
 * Handles authentication headers, API versioning, retries with exponential backoff,
 * rate limit tracking, and structured error handling.
 */

import { RateLimiter } from './rate-limiter.js';
import { ApiVersionManager } from './version-manager.js';
import { LinkedInApiError, RetryableError } from './errors.js';
import type { LinkedInApiErrorResponse } from '../types/index.js';

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  versioned?: boolean; // Whether to include LinkedIn-Version header (default: true)
}

export interface ApiClientConfig {
  baseUrl: string;
  maxRetries?: number;
  getAccessToken: () => Promise<string>;
}

export class LinkedInApiClient {
  private rateLimiter: RateLimiter;
  private versionManager: ApiVersionManager;
  private config: ApiClientConfig;
  private maxRetries: number;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.maxRetries = config.maxRetries ?? 3;
    this.rateLimiter = new RateLimiter();
    this.versionManager = new ApiVersionManager();
  }

  /**
   * Make an authenticated request to the LinkedIn API with retry logic.
   */
  async request<T>(requestConfig: RequestConfig): Promise<T> {
    const endpoint = `${requestConfig.method} ${requestConfig.path}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.rateLimiter.waitIfNeeded(endpoint);
        const token = await this.config.getAccessToken();

        const url = `${this.config.baseUrl}${requestConfig.path}`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...( (requestConfig.versioned ?? true) ? this.versionManager.getHeaders() : {}),
          ...requestConfig.headers,
        };

        const response = await fetch(url, {
          method: requestConfig.method,
          headers,
          body: requestConfig.body ? JSON.stringify(requestConfig.body) : undefined,
        });

        this.rateLimiter.track(endpoint, response.status, response.headers);

        if (response.status === 401 && attempt < this.maxRetries) {
          // Token might have expired mid-request
          throw new RetryableError('Authentication expired');
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          throw new RetryableError('Rate limited', delayMs);
        }

        if (response.status >= 500 && attempt < this.maxRetries) {
          throw new RetryableError(`Server error: ${response.status}`);
        }

        if (!response.ok) {
          let errorBody: LinkedInApiErrorResponse;
          try {
            errorBody = (await response.json()) as LinkedInApiErrorResponse;
          } catch {
            errorBody = { status: response.status, message: response.statusText };
          }
          throw LinkedInApiError.fromResponse(response.status, errorBody);
        }

        // Handle 204 No Content
        if (response.status === 204) {
          return undefined as T;
        }

        // Some responses return the resource ID in the header
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return (await response.json()) as T;
        }

        // For non-JSON responses (e.g., image upload), return the header info
        const resourceId = response.headers.get('x-restli-id');
        if (resourceId) {
          return { id: resourceId } as T;
        }

        return undefined as T;
      } catch (error) {
        if (error instanceof RetryableError && attempt < this.maxRetries) {
          const delay =
            error.retryAfterMs ?? this.rateLimiter.getBackoffDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Convenience methods for common HTTP verbs.
   */
  async get<T>(path: string, versioned?: boolean): Promise<T> {
    return this.request<T>({ method: 'GET', path, versioned });
  }

  async post<T>(path: string, body?: unknown, versioned?: boolean): Promise<T> {
    return this.request<T>({ method: 'POST', path, body, versioned });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'PUT', path, body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>({ method: 'DELETE', path });
  }

  /**
   * Upload binary data (for image uploads).
   */
  async uploadBinary(uploadUrl: string, data: Buffer, contentType: string): Promise<void> {
    const token = await this.config.getAccessToken();

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: data,
    });

    if (!response.ok) {
      throw new LinkedInApiError(
        response.status,
        `Image upload failed: ${response.statusText}`,
      );
    }
  }

  /**
   * Get rate limit information for all tracked endpoints.
   */
  getRateLimitInfo() {
    return this.rateLimiter.getAllInfo();
  }
}
