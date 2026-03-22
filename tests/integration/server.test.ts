import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLinkedInMcpServer } from '../../src/server.js';
import { TokenStore } from '../../src/auth/token-store.js';
import { LinkedInApiMock } from '../mocks/linkedin-api-mock.js';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('LinkedIn MCP Server Integration', () => {
  let mock: LinkedInApiMock;
  let tempDir: string;
  let client: Client;
  let serverHandle: ReturnType<typeof createLinkedInMcpServer>;

  beforeAll(async () => {
    mock = new LinkedInApiMock();
    await mock.start();
  });

  afterAll(async () => {
    await mock.stop();
  });

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'linkedin-mcp-integration-'));
    mock.clearRequestLog();

    const tokenStore = new TokenStore(join(tempDir, 'test.db'));

    // Pre-seed a valid token so tools work without auth flow
    tokenStore.save({
      userId: 'mock-user-123',
      accessToken: 'mock-access-token',
      scopes: ['openid', 'profile', 'email', 'w_member_social'],
      expiresAt: Date.now() + 3600000,
      createdAt: Date.now(),
    });

    serverHandle = createLinkedInMcpServer({
      config: {
        linkedin: {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          redirectUri: 'http://localhost:3000/callback',
          scopes: [],
          apiBaseUrl: mock.url,
          authBaseUrl: `${mock.url}/oauth/v2`,
        },
        server: {
          name: 'test-linkedin-mcp',
          version: '0.0.1',
          transport: 'stdio',
        },
        storage: { dbPath: join(tempDir, 'test.db') },
      },
      tokenStore,
    });

    serverHandle.setCurrentUserId('mock-user-123');

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });

    await serverHandle.server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Tool listing', () => {
    it('should list all registered tools', async () => {
      const { tools } = await client.listTools();
      const toolNames = tools.map((t) => t.name);

      // Auth tools
      expect(toolNames).toContain('linkedin_auth_start');
      expect(toolNames).toContain('linkedin_auth_callback');
      expect(toolNames).toContain('linkedin_auth_logout');

      // Profile tools
      expect(toolNames).toContain('linkedin_get_my_profile');
      expect(toolNames).toContain('linkedin_get_my_email');
      expect(toolNames).toContain('linkedin_get_auth_status');
      expect(toolNames).toContain('linkedin_get_rate_limits');

      // Posting tools
      expect(toolNames).toContain('linkedin_create_post');
      expect(toolNames).toContain('linkedin_delete_post');
      expect(toolNames).toContain('linkedin_create_comment');
      expect(toolNames).toContain('linkedin_react_to_post');
      expect(toolNames).toContain('linkedin_upload_image');

      // Event tools
      expect(toolNames).toContain('linkedin_create_event');
      expect(toolNames).toContain('linkedin_get_event');
    });
  });

  describe('Profile tools', () => {
    it('should get user profile', async () => {
      const result = await client.callTool({
        name: 'linkedin_get_my_profile',
        arguments: {},
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const profile = JSON.parse(text);

      expect(profile.id).toBe('mock-user-123');
      expect(profile.name).toBe('Test User');
      expect(profile.email).toBe('test@example.com');
    });

    it('should get user email', async () => {
      const result = await client.callTool({
        name: 'linkedin_get_my_email',
        arguments: {},
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);

      expect(data.email).toBe('test@example.com');
      expect(data.emailVerified).toBe(true);
    });
  });

  describe('Posting tools', () => {
    it('should create a text post', async () => {
      const result = await client.callTool({
        name: 'linkedin_create_post',
        arguments: {
          text: 'Hello from MCP integration test!',
          visibility: 'PUBLIC',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);

      expect(data.success).toBe(true);
      expect(result.isError).toBeFalsy();

      // Verify the request was made correctly
      const requests = mock.getRequestLog();
      const postRequest = requests.find((r) => r.path === '/v2/posts' && r.method === 'POST');
      expect(postRequest).toBeDefined();

      const body = JSON.parse(postRequest!.body);
      expect(body.author).toBe('urn:li:person:mock-user-123');
      expect(body.commentary).toBe('Hello from MCP integration test!');
      expect(body.visibility).toBe('PUBLIC');
      expect(body.distribution.feedDistribution).toBe('MAIN_FEED');
      expect(body.lifecycleState).toBe('PUBLISHED');
    });

    it('should create a post with article link', async () => {
      const result = await client.callTool({
        name: 'linkedin_create_post',
        arguments: {
          text: 'Check out this article',
          visibility: 'CONNECTIONS',
          articleUrl: 'https://example.com/article',
          articleTitle: 'Test Article',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.success).toBe(true);

      const requests = mock.getRequestLog();
      const postRequest = requests.find((r) => r.path === '/v2/posts');
      const body = JSON.parse(postRequest!.body);
      expect(body.content.article.source).toBe('https://example.com/article');
      expect(body.content.article.title).toBe('Test Article');
    });

    it('should create a comment on a post', async () => {
      const result = await client.callTool({
        name: 'linkedin_create_comment',
        arguments: {
          postUrn: 'urn:li:share:12345',
          text: 'Great post!',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.success).toBe(true);
    });

    it('should react to a post', async () => {
      const result = await client.callTool({
        name: 'linkedin_react_to_post',
        arguments: {
          postUrn: 'urn:li:share:12345',
          reactionType: 'LIKE',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.success).toBe(true);
      expect(data.message).toContain('LIKE');
    });

    it('should delete a post', async () => {
      const result = await client.callTool({
        name: 'linkedin_delete_post',
        arguments: {
          postUrn: 'urn:li:share:12345',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.success).toBe(true);
    });
  });

  describe('Event tools', () => {
    it('should create an event', async () => {
      const result = await client.callTool({
        name: 'linkedin_create_event',
        arguments: {
          name: 'Test Webinar',
          description: 'A test event for integration testing',
          startDate: '2026-04-01T10:00:00Z',
          format: 'ONLINE',
          eventUrl: 'https://example.com/meeting',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Test Webinar');
    });

    it('should get event details', async () => {
      const result = await client.callTool({
        name: 'linkedin_get_event',
        arguments: {
          eventId: 'urn:li:event:mock-123',
        },
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.name).toBe('Test Event');
      expect(data.format).toBe('ONLINE');
    });
  });

  describe('Auth tools', () => {
    it('should generate an authorization URL', async () => {
      const result = await client.callTool({
        name: 'linkedin_auth_start',
        arguments: {},
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('authorization');
      expect(text).toContain('client_id=test-client-id');
      expect(text).toContain('code_challenge');
      expect(text).toContain('State:');
    });

    it('should check auth status', async () => {
      const result = await client.callTool({
        name: 'linkedin_get_auth_status',
        arguments: {},
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      const data = JSON.parse(text);
      expect(data.authenticated).toBe(true);
      expect(data.userId).toBe('mock-user-123');
    });

    it('should show rate limit info', async () => {
      // Make a call first to populate rate limits
      await client.callTool({
        name: 'linkedin_get_my_profile',
        arguments: {},
      });

      const result = await client.callTool({
        name: 'linkedin_get_rate_limits',
        arguments: {},
      });

      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      // Should have some rate limit data now
      expect(text).not.toContain('No API calls');
    });
  });
});
