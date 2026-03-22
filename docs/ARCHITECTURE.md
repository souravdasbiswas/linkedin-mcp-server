# Architecture

## Overview

The LinkedIn MCP Server is a TypeScript application that bridges MCP clients (Claude Code, Claude Desktop, etc.) with LinkedIn's official REST API v2. It uses stdio transport for local single-user operation.

```
MCP Client (Claude Code, Claude Desktop)
    |
    | stdio (JSON-RPC over stdin/stdout)
    v
+-----------------------------------------------+
|            LinkedIn MCP Server                 |
|                                                |
|  +----------+  +----------+  +----------+     |
|  |   Auth   |  |  Tools   |  |Resources |     |
|  |  Module   |  | Registry |  | Registry |     |
|  +----+-----+  +----+-----+  +----+-----+     |
|       |              |              |           |
|  +----v--------------v--------------v------+   |
|  |           Middleware Pipeline            |   |
|  |  [Rate Limiter] [Error Handler] [Retry] |   |
|  +-------------------+--------------------+   |
|                      |                         |
|  +-------------------v--------------------+   |
|  |          LinkedIn API Client            |   |
|  |  [Auth Headers] [Versioning] [Backoff]  |   |
|  +-----------------------------------------+   |
+--------------------+--------------------------+
                     |
                     | HTTPS
                     v
           LinkedIn REST API v2
```

## Design Principles

### 1. Official API Only

Every API call goes through LinkedIn's documented REST API v2. No browser automation, no reverse-engineered endpoints, no unofficial libraries. This ensures:
- Zero risk of account suspension
- Stability across LinkedIn UI changes
- Compliance with LinkedIn's Terms of Service

### 2. Scope-Aware Capability Detection

Users have different API access levels. A self-serve developer has 4 scopes. A Community Management API partner has 10+. The server adapts.

```
OAuth Callback
    |
    v
CapabilityDetector.detect(grantedScopes)
    |
    v
EnabledModules {
  auth: true,         // always
  profile: true,      // openid + profile
  posting: true,      // w_member_social
  events: true,       // w_member_social
  orgManagement: false // r_organization_social (not granted)
  advertising: false   // r_ads (not granted)
}
```

Currently, all self-serve tools are registered at startup (they return auth errors if not authenticated). For vetted modules, tools would only be registered when the corresponding scopes are detected.

### 3. Resilient API Communication

```
API Call
  |
  v
Rate Limiter (check budget) --[over limit]--> Wait
  |
  v
Add Auth Header + API Version Headers
  |
  v
HTTP Request
  |
  +--[200-299]--> Parse response, track rate limit headers
  |
  +--[401]------> Refresh token, retry
  |
  +--[429]------> Parse Retry-After, exponential backoff, retry
  |
  +--[500+]-----> Exponential backoff, retry (max 3)
  |
  +--[4xx]------> Throw LinkedInApiError with user-friendly message
```

### 4. Token Lifecycle

```
First Use:
  linkedin_auth_start --> Generate OAuth URL (state param for CSRF protection)
  User authorizes in browser
  linkedin_auth_callback --> Exchange code + client_secret for token
  Token stored in SQLite (~/.linkedin-mcp/tokens.db)
  currentUserId set in memory
  Token valid for 60 days

Server Restart (auto-restore):
  Server starts --> tokenStore.findActiveUser()
  If valid token exists in SQLite --> Set currentUserId automatically
  If no valid token --> Tools return "Not authenticated" error
  User only re-authenticates when token actually expires

Subsequent Uses:
  Tool call --> getAccessToken()
  Check SQLite for stored token
  If valid (>5min until expiry) --> Use it
  If expired + refresh token --> Refresh and store new token
  If expired + no refresh --> Error: re-authenticate

Logout:
  linkedin_auth_logout --> Revoke via LinkedIn API + delete from SQLite
```

## Module System

Each functional area is an independent module that registers its own MCP tools.

```
modules/
  profile/tools.ts    # registerProfileTools(server, apiClient)
  posting/tools.ts    # registerPostingTools(server, apiClient, getUserId, postHistory)
  events/tools.ts     # registerEventTools(server, apiClient, getUserId)
```

### Adding a New Module

1. Create `src/modules/<name>/tools.ts`
2. Export a `register<Name>Tools(server, apiClient, ...)` function
3. Define tools using `server.tool(name, description, schema, handler)`
4. Add required scopes to `CapabilityDetector.MODULE_SCOPE_REQUIREMENTS`
5. Register in `server.ts`
6. Add mock routes in `tests/mocks/linkedin-api-mock.ts`
7. Write integration tests

## Data Flow

### Creating a Post

```
User: "Post to LinkedIn: Hello world!"
  |
  v
MCP Client sends tool call: linkedin_create_post({ text: "Hello world!", visibility: "PUBLIC" })
  |
  v
Posting Module handler:
  1. getUserId() --> reads from current session
  2. Build CreatePostRequest with author URN, text, visibility, distribution
  3. apiClient.post('/v2/posts', request)
      |
      v
  API Client:
    a. rateLimiter.waitIfNeeded('POST /v2/posts')
    b. authManager.getAccessToken() --> reads from SQLite
    c. fetch('https://api.linkedin.com/v2/posts', {
         method: 'POST',
         headers: {
           Authorization: 'Bearer <token>',
           LinkedIn-Version: '202603',
           X-Restli-Protocol-Version: '2.0.0',
           Content-Type: 'application/json'
         },
         body: JSON.stringify(request)
       })
    d. rateLimiter.track('POST /v2/posts', response.status, response.headers)
    e. Return parsed response
  |
  v
Return MCP result: { success: true, postUrn: "urn:li:share:123" }
  |
  v
Post saved to local history (SQLite post_history table)
  - text preview (first 200 chars), visibility, timestamps, flags
```

### Listing and Deleting Posts

```
User: "List my LinkedIn posts"
  |
  v
linkedin_list_my_posts --> postHistory.list(limit)
  --> Reads from local SQLite post_history table
  --> Returns numbered list with date, preview, visibility, URN

User: "Delete post urn:li:share:123"
  |
  v
linkedin_delete_post --> apiClient.delete('/v2/posts/...')
  --> On success: postHistory.remove(postUrn)
  --> Post removed from both LinkedIn and local history
```

## Rate Limiting Strategy

LinkedIn doesn't publish exact rate limits. The adaptive rate limiter handles this:

```
Initial state:
  Every endpoint starts with a conservative limit of 80 calls/day

Learning from headers:
  LinkedIn sometimes returns X-RateLimit-Limit and X-RateLimit-Remaining headers
  When received, the limiter updates its internal tracking to match

Learning from 429s:
  If we get rate-limited, the limiter reduces its estimate for that endpoint
  Respects Retry-After header for the wait duration

Reset:
  All counters reset at midnight UTC (LinkedIn's reset window)
```

## Error Handling

Errors are categorized and handled differently:

| Error Type | HTTP Status | Action |
|-----------|-------------|--------|
| Retryable | 429, 5xx | Exponential backoff + retry (max 3) |
| Auth | 401 | Refresh token + retry once |
| Permission | 403 | User-friendly message about missing scopes |
| Client | 4xx | Throw with LinkedIn's error details |
| Network | 0 / timeout | Retry with backoff |

All errors surfaced to the MCP client include a `toUserMessage()` that translates technical details into actionable guidance.

## Storage

SQLite via `better-sqlite3` stores:

| Table | Purpose |
|-------|---------|
| `tokens` | OAuth access/refresh tokens, scopes, expiry timestamps |
| `pkce_state` | Temporary OAuth state for callback validation (auto-cleaned after 30min) |
| `post_history` | Local record of posts created through this server (URN, text preview, visibility, timestamps) |

WAL mode is enabled for concurrent read performance. The database lives at `~/.linkedin-mcp/tokens.db` by default.

### Post History Schema

| Column | Type | Purpose |
|--------|------|---------|
| `post_urn` | TEXT (PK) | LinkedIn post URN |
| `text_preview` | TEXT | First 200 chars of post text |
| `visibility` | TEXT | PUBLIC / CONNECTIONS / LOGGED_IN |
| `has_image` | INTEGER | Whether post had an image |
| `has_article` | INTEGER | Whether post had an article link |
| `article_url` | TEXT | The article URL if present |
| `created_at` | INTEGER | Creation timestamp |

Note: Only posts created through this MCP server are tracked. LinkedIn's self-serve API does not provide an endpoint to list your own posts (`r_member_social` scope is restricted).

## Testing Strategy

```
Layer 1: Unit Tests (tests/unit/)
  - Pure function testing: PKCE, rate limiter, version manager, errors, capabilities
  - SQLite token store with temp databases
  - No network calls

Layer 2: Integration Tests (tests/integration/)
  - Full MCP protocol via InMemoryTransport
  - Mock LinkedIn API server (real HTTP on localhost)
  - Tests tool registration, input validation, response formatting

Layer 3: Contract Tests (tests/contract/)
  - Validate request/response shapes match LinkedIn API documentation
  - No network calls - pure schema validation
  - Catches API contract drift
```

The mock server (`tests/mocks/linkedin-api-mock.ts`) supports:
- Pattern-based routing with `:param` placeholders
- Route overriding for per-test scenarios
- Request logging for assertions
- Pre-built scenarios: rate limiting, auth failure, server error

## Security Considerations

- **Confidential client auth**: Client secret is used for token exchange (server-side only, never exposed to browser)
- **State parameter**: Random 32-byte hex string prevents CSRF in OAuth flow
- **Token storage**: Tokens are stored in SQLite in the user's home directory with default filesystem permissions
- **No credentials in code**: Client ID/secret are environment variables only
- **Token auto-expiry**: 5-minute safety margin before actual expiry
- **Session auto-restore**: Only restores sessions with valid (non-expired) tokens
- **No eval/exec**: All LinkedIn data is treated as untrusted; JSON.parse only
