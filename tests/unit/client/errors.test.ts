import { describe, it, expect } from 'vitest';
import { LinkedInApiError, RetryableError, AuthenticationRequiredError } from '../../../src/client/errors.js';

describe('LinkedInApiError', () => {
  it('should create from response body', () => {
    const error = LinkedInApiError.fromResponse(403, {
      status: 403,
      message: 'Insufficient scope',
      code: 'ACCESS_DENIED',
      serviceErrorCode: 100,
    });

    expect(error.status).toBe(403);
    expect(error.message).toBe('Insufficient scope');
    expect(error.linkedInCode).toBe('ACCESS_DENIED');
    expect(error.serviceErrorCode).toBe(100);
  });

  it('should identify retryable errors', () => {
    expect(new LinkedInApiError(429, 'Rate limited').isRetryable).toBe(true);
    expect(new LinkedInApiError(500, 'Server error').isRetryable).toBe(true);
    expect(new LinkedInApiError(502, 'Bad gateway').isRetryable).toBe(true);
    expect(new LinkedInApiError(400, 'Bad request').isRetryable).toBe(false);
    expect(new LinkedInApiError(403, 'Forbidden').isRetryable).toBe(false);
  });

  it('should identify auth errors', () => {
    expect(new LinkedInApiError(401, 'Unauthorized').isAuthError).toBe(true);
    expect(new LinkedInApiError(403, 'Forbidden').isAuthError).toBe(true);
    expect(new LinkedInApiError(400, 'Bad request').isAuthError).toBe(false);
  });

  it('should produce user-friendly messages', () => {
    expect(new LinkedInApiError(401, 'err').toUserMessage()).toContain('re-authenticate');
    expect(new LinkedInApiError(403, 'err').toUserMessage()).toContain('Permission denied');
    expect(new LinkedInApiError(429, 'err').toUserMessage()).toContain('Rate limit');
    expect(new LinkedInApiError(400, 'Bad input').toUserMessage()).toContain('Bad input');
  });
});

describe('RetryableError', () => {
  it('should store retry delay', () => {
    const error = new RetryableError('Rate limited', 5000);
    expect(error.retryAfterMs).toBe(5000);
    expect(error.name).toBe('RetryableError');
  });
});

describe('AuthenticationRequiredError', () => {
  it('should have default message', () => {
    const error = new AuthenticationRequiredError();
    expect(error.message).toContain('Not authenticated');
  });
});
