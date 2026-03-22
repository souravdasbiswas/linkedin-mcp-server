# LinkedIn MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with access to LinkedIn's official API. Create posts, manage events, and interact with LinkedIn - all through natural language via any MCP-compatible client.

**Official API only.** No scraping, no unofficial endpoints, no account risk.

## Features

### Self-Serve Tools (No LinkedIn Approval Required)

| Tool | Description |
|------|-------------|
| `linkedin_auth_start` | Start OAuth 2.0 authentication flow |
| `linkedin_auth_callback` | Complete OAuth with authorization code |
| `linkedin_auth_logout` | Revoke token and log out |
| `linkedin_get_my_profile` | Get your LinkedIn profile (name, headline, photo, email) |
| `linkedin_get_my_email` | Get your email address |
| `linkedin_get_auth_status` | Check authentication status |
| `linkedin_get_rate_limits` | View API rate limit usage |
| `linkedin_create_post` | Create text, article, or image posts |
| `linkedin_delete_post` | Delete your posts |
| `linkedin_create_comment` | Comment on posts |
| `linkedin_react_to_post` | React to posts (like, celebrate, support, love, insightful, funny) |
| `linkedin_upload_image` | Upload images for posts |
| `linkedin_list_my_posts` | List posts created through this server with URNs for reference |
| `linkedin_create_event` | Create LinkedIn events |
| `linkedin_get_event` | Get event details |

### Architecture Highlights

- **OAuth 2.0** - Secure authentication with persistent token storage
- **Session auto-restore** - Survives server restarts without re-authentication (until token expires)
- **Post history tracking** - Local SQLite log of posts created through the server for easy reference and deletion
- **Adaptive rate limiting** - Learns LinkedIn's actual limits from response headers
- **Automatic retry** - Exponential backoff for transient failures (429, 5xx)
- **Capability detection** - Only exposes tools matching your granted scopes
- **API versioning** - Handles LinkedIn's monthly API version rotation

## Prerequisites

1. **Node.js 20+**
2. **LinkedIn Developer App** - Create one at [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
3. Enable these products in your app's Products tab:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn**

## Quick Start

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure Your MCP Client

Add to your MCP client configuration (e.g., Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/path/to/linkedin-mcp-server/dist/index.js"],
      "env": {
        "LINKEDIN_CLIENT_ID": "your_client_id",
        "LINKEDIN_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

For Claude Code, add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/path/to/linkedin-mcp-server/dist/index.js"],
      "env": {
        "LINKEDIN_CLIENT_ID": "your_client_id",
        "LINKEDIN_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### 3. Authenticate

Once connected, tell your AI assistant:

> "Authenticate with LinkedIn"

The assistant will use `linkedin_auth_start` to generate an OAuth URL. Open it in your browser, authorize the app, and provide the callback URL parameters back to the assistant.

### 4. Use It

Example prompts:

- "Post to LinkedIn: Just shipped a new feature that reduces API latency by 40%"
- "List my LinkedIn posts" - see all posts you've made through the server
- "Delete my last LinkedIn post"
- "Create a LinkedIn event for our team meetup next Friday at 2pm"
- "React to this LinkedIn post with a celebrate reaction"
- "What's my LinkedIn profile info?"

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LINKEDIN_CLIENT_ID` | Yes | - | LinkedIn app client ID |
| `LINKEDIN_CLIENT_SECRET` | Yes | - | LinkedIn app client secret |
| `LINKEDIN_REDIRECT_URI` | No | `http://localhost:3000/callback` | OAuth redirect URI |
| `LINKEDIN_MCP_DATA_DIR` | No | `~/.linkedin-mcp` | Directory for token storage |
| `LINKEDIN_API_BASE_URL` | No | `https://api.linkedin.com` | API base URL (override for testing) |
| `LINKEDIN_AUTH_BASE_URL` | No | `https://www.linkedin.com/oauth/v2` | Auth base URL |

## Development

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Lint
npm run lint

# Dev mode (tsx, no build needed)
npm run dev
```

### Testing Architecture

Tests run entirely against a mock LinkedIn API server - no real API calls are made.

| Layer | What It Tests | Files |
|-------|-------------|-------|
| **Unit tests** | Auth, PKCE, token store, rate limiter, errors, capabilities | `tests/unit/` |
| **Integration tests** | Full MCP protocol flow via in-memory transport | `tests/integration/` |
| **Contract tests** | Request/response shapes match LinkedIn API spec | `tests/contract/` |

### Project Structure

```
src/
  index.ts              # Entry point, stdio transport
  server.ts             # MCP server wiring
  auth/
    oauth2.ts           # OAuth 2.0 flow + token exchange
    token-store.ts      # SQLite token persistence + session auto-restore
    pkce.ts             # PKCE challenge generation (available for public clients)
    tools.ts            # Auth MCP tools
  client/
    api-client.ts       # HTTP client with retry
    rate-limiter.ts     # Adaptive rate limiting
    version-manager.ts  # LinkedIn API versioning
    errors.ts           # Structured error types
    post-history.ts     # Local post tracking (SQLite)
  capabilities/
    detector.ts         # Scope-based capability detection
  modules/
    profile/tools.ts    # Profile reading tools
    posting/tools.ts    # Post creation/management tools
    events/tools.ts     # Event management tools
  types/
    linkedin.ts         # LinkedIn API type definitions
    config.ts           # Server configuration types
```

## Limitations

These are LinkedIn API restrictions, not server limitations:

- **Cannot read others' profiles** - Only the authenticated user's own profile
- **Cannot search for people** - No public search API
- **Cannot send messages** - Only available to Sales Navigator partners
- **Cannot read feeds** - `r_member_social` scope is closed
- **Cannot access connections** - Only connection count with Marketing API approval
- **Rate limits** - ~500 app calls/day, ~100 per member/day (development tier)

## Extending to Pro Tier

If your LinkedIn app has Community Management API or Advertising API approval, the server's capability detection will automatically enable additional modules when you authenticate with the corresponding scopes. The modular architecture supports adding new API modules without modifying the core server.

## License

MIT
