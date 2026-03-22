/**
 * Structured error types for LinkedIn API interactions.
 */

import type { LinkedInApiErrorResponse } from '../types/index.js';

export class LinkedInApiError extends Error {
  public readonly status: number;
  public readonly serviceErrorCode?: number;
  public readonly linkedInCode?: string;

  constructor(status: number, message: string, serviceErrorCode?: number, code?: string) {
    super(message);
    this.name = 'LinkedInApiError';
    this.status = status;
    this.serviceErrorCode = serviceErrorCode;
    this.linkedInCode = code;
  }

  static fromResponse(status: number, body: LinkedInApiErrorResponse): LinkedInApiError {
    return new LinkedInApiError(
      status,
      body.message || `LinkedIn API error: ${status}`,
      body.serviceErrorCode,
      body.code,
    );
  }

  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  toUserMessage(): string {
    if (this.status === 401) {
      return 'Authentication failed. Please re-authenticate using linkedin_auth_start.';
    }
    if (this.status === 403) {
      return 'Permission denied. Your LinkedIn app may not have the required scope for this action.';
    }
    if (this.status === 429) {
      return 'Rate limit exceeded. Please wait before making more requests.';
    }
    return `LinkedIn API error (${this.status}): ${this.message}`;
  }
}

export class RetryableError extends Error {
  public readonly retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message?: string) {
    super(message ?? 'Not authenticated. Please use linkedin_auth_start to authenticate first.');
    this.name = 'AuthenticationRequiredError';
  }
}
