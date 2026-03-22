/**
 * Mock LinkedIn API server for testing.
 * Simulates LinkedIn REST API responses including success, errors,
 * rate limits, and auth failures.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

interface MockRoute {
  handler: (req: IncomingMessage, body: string) => MockResponse;
}

interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export class LinkedInApiMock {
  private server: ReturnType<typeof createServer> | null = null;
  private routes = new Map<string, MockRoute>();
  private requestLog: Array<{ method: string; path: string; body: string; headers: Record<string, string> }> = [];
  public port = 0;

  constructor() {
    this.setupDefaultRoutes();
  }

  private setupDefaultRoutes(): void {
    // OAuth token exchange
    this.addRoute('POST /oauth/v2/accessToken', (_req, body) => {
      const params = new URLSearchParams(body);
      if (params.get('grant_type') === 'authorization_code') {
        return {
          status: 200,
          body: {
            access_token: 'mock-access-token-' + Date.now(),
            expires_in: 5184000,
            scope: 'openid profile email w_member_social',
          },
        };
      }
      if (params.get('grant_type') === 'refresh_token') {
        return {
          status: 200,
          body: {
            access_token: 'mock-refreshed-token-' + Date.now(),
            expires_in: 5184000,
            scope: 'openid profile email w_member_social',
          },
        };
      }
      return { status: 400, body: { message: 'Invalid grant_type' } };
    });

    // Token revocation
    this.addRoute('POST /oauth/v2/revoke', () => ({ status: 200 }));

    // UserInfo endpoint
    this.addRoute('GET /v2/userinfo', () => ({
      status: 200,
      body: {
        sub: 'mock-user-123',
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://media.licdn.com/dms/image/mock/photo.jpg',
        email: 'test@example.com',
        email_verified: true,
        locale: { language: 'en', country: 'US' },
      },
    }));

    // Create post
    this.addRoute('POST /v2/posts', (_req, body) => {
      const parsed = JSON.parse(body);
      if (!parsed.author || !parsed.commentary) {
        return {
          status: 422,
          body: { status: 422, message: 'Missing required fields: author, commentary' },
        };
      }
      return {
        status: 201,
        body: { id: `urn:li:share:mock-${Date.now()}` },
        headers: {
          'x-restli-id': `urn:li:share:mock-${Date.now()}`,
          'x-ratelimit-limit': '100',
          'x-ratelimit-remaining': '95',
        },
      };
    });

    // Delete post
    this.addRoute('DELETE /v2/posts/:id', () => ({ status: 204 }));

    // Create comment
    this.addRoute('POST /v2/socialActions/:postUrn/comments', (_req, body) => {
      const parsed = JSON.parse(body);
      if (!parsed.actor || !parsed.message) {
        return {
          status: 422,
          body: { status: 422, message: 'Missing required fields: actor, message' },
        };
      }
      return {
        status: 201,
        body: { id: `urn:li:comment:mock-${Date.now()}` },
      };
    });

    // React to post
    this.addRoute('POST /v2/socialActions/:postUrn/likes', () => ({
      status: 201,
      body: { success: true },
    }));

    // Initialize image upload
    this.addRoute('POST /v2/images', () => ({
      status: 200,
      body: {
        value: {
          uploadUrlExpiresAt: Date.now() + 3600000,
          uploadUrl: 'https://mock-upload.linkedin.com/upload/image',
          image: `urn:li:image:mock-${Date.now()}`,
        },
      },
    }));

    // Create event
    this.addRoute('POST /v2/events', (_req, body) => {
      const parsed = JSON.parse(body);
      if (!parsed.organizer || !parsed.name) {
        return {
          status: 422,
          body: { status: 422, message: 'Missing required fields: organizer, name' },
        };
      }
      return {
        status: 201,
        body: { id: `urn:li:event:mock-${Date.now()}` },
      };
    });

    // Get event
    this.addRoute('GET /v2/events/:id', () => ({
      status: 200,
      body: {
        id: 'urn:li:event:mock-123',
        organizer: 'urn:li:person:mock-user-123',
        name: 'Test Event',
        description: 'A test event',
        timeRange: { start: '2026-04-01T10:00:00Z' },
        format: 'ONLINE',
      },
    }));
  }

  /**
   * Add a route handler. Pattern supports :param placeholders.
   */
  addRoute(
    pattern: string,
    handler: (req: IncomingMessage, body: string) => MockResponse,
  ): void {
    this.routes.set(pattern, { handler });
  }

  /**
   * Override a route for a specific test scenario.
   */
  overrideRoute(
    pattern: string,
    handler: (req: IncomingMessage, body: string) => MockResponse,
  ): () => void {
    const original = this.routes.get(pattern);
    this.routes.set(pattern, { handler });
    return () => {
      if (original) {
        this.routes.set(pattern, original);
      } else {
        this.routes.delete(pattern);
      }
    };
  }

  /**
   * Get the request log for assertions.
   */
  getRequestLog() {
    return [...this.requestLog];
  }

  clearRequestLog(): void {
    this.requestLog = [];
  }

  /**
   * Start the mock server on a random available port.
   */
  async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(0, () => {
        const addr = this.server!.address();
        this.port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(this.port);
      });
    });
  }

  /**
   * Stop the mock server.
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  get url(): string {
    return `http://localhost:${this.port}`;
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const method = req.method ?? 'GET';
      const url = req.url ?? '/';
      const path = url.split('?')[0];

      // Log the request
      this.requestLog.push({
        method,
        path,
        body,
        headers: req.headers as Record<string, string>,
      });

      // Find matching route
      const route = this.findRoute(method, path);
      if (!route) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 404, message: `No mock for ${method} ${path}` }));
        return;
      }

      const response = route.handler(req, body);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...response.headers,
      };

      res.writeHead(response.status, headers);
      if (response.body !== undefined) {
        res.end(JSON.stringify(response.body));
      } else {
        res.end();
      }
    });
  }

  private findRoute(method: string, path: string): MockRoute | undefined {
    // Try exact match first
    const exactKey = `${method} ${path}`;
    if (this.routes.has(exactKey)) {
      return this.routes.get(exactKey);
    }

    // Try pattern matching with :param placeholders
    for (const [pattern, route] of this.routes) {
      const [routeMethod, routePath] = pattern.split(' ', 2);
      if (routeMethod !== method) continue;

      const routeParts = routePath.split('/');
      const pathParts = path.split('/');

      // Allow route patterns to match paths that are longer (e.g., /v2/posts/:id matches /v2/posts/urn%3Ali%3Ashare%3A123)
      if (routeParts.length !== pathParts.length) {
        // Check if the pattern has wildcards at the end
        if (routeParts.length > pathParts.length) continue;

        // Check if non-param parts match for prefix matching
        let prefixMatch = true;
        for (let i = 0; i < routeParts.length; i++) {
          if (routeParts[i].startsWith(':')) continue;
          if (routeParts[i] !== pathParts[i]) {
            prefixMatch = false;
            break;
          }
        }
        if (prefixMatch && routeParts[routeParts.length - 1].startsWith(':')) {
          return route;
        }
        continue;
      }

      let match = true;
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) continue;
        if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }
      if (match) return route;
    }

    return undefined;
  }
}

/**
 * Create pre-configured mock responses for specific test scenarios.
 */
export const mockScenarios = {
  /** Simulate a rate-limited response */
  rateLimited: (): MockResponse => ({
    status: 429,
    body: { status: 429, message: 'Rate limit exceeded' },
    headers: { 'retry-after': '1' },
  }),

  /** Simulate an expired token */
  unauthorized: (): MockResponse => ({
    status: 401,
    body: { status: 401, message: 'Unauthorized', code: 'UNAUTHORIZED' },
  }),

  /** Simulate a server error */
  serverError: (): MockResponse => ({
    status: 500,
    body: { status: 500, message: 'Internal Server Error' },
  }),

  /** Simulate forbidden (insufficient scopes) */
  forbidden: (): MockResponse => ({
    status: 403,
    body: { status: 403, message: 'Insufficient scope', code: 'ACCESS_DENIED' },
  }),
};
