# LinkedIn MCP Server

[![linkedin-mcp-server MCP server](https://glama.ai/mcp/servers/souravdasbiswas/linkedin-mcp-server/badges/score.svg)](https://glama.ai/mcp/servers/souravdasbiswas/linkedin-mcp-server)

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
2. **LinkedIn Developer App** (see setup steps below)

## LinkedIn App Setup

### Step 1: Create a LinkedIn Developer App

1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) and sign in
2. Click **Create app**
3. Fill in the required fields:
   - **App name**: Choose any name (e.g., "My MCP LinkedIn")
   - **LinkedIn Page**: Select your LinkedIn page, or create one if needed
   - **Privacy policy URL**: Can use your website URL or a placeholder
   - **App logo**: Upload any image (required)
4. Check the legal agreement box and click **Create app**

### Step 2: Get Your Client ID and Client Secret

1. After creating the app, you'll land on the app settings page
2. Go to the **Auth** tab
3. Copy the **Client ID** - you'll need this for configuration
4. Copy the **Client Secret** (click the eye icon to reveal it) - you'll need this too

### Step 3: Add the Redirect URL

1. Still on the **Auth** tab, scroll to **OAuth 2.0 settings**
2. Under **Authorized redirect URLs for your app**, click **Add redirect URL**
3. Enter: `http://localhost:3000/callback`
4. Click **Update** to save

> **Important**: The redirect URL must match exactly - including the protocol (`http://`), port (`:3000`), and path (`/callback`). No trailing slash.

### Step 4: Enable Required Products

1. Go to the **Products** tab on your app page
2. Request access to these two products:
   - **Sign In with LinkedIn using OpenID Connect** - click **Request access**, review terms, and accept
   - **Share on LinkedIn** - click **Request access**, review terms, and accept
3. Both products are typically approved instantly for self-serve use

> **Verify**: After enabling, go back to the **Auth** tab. Under **OAuth 2.0 scopes**, you should see: `openid`, `profile`, `email`, `w_member_social`.

## Quick Start

### 1. Install

```bash
git clone https://github.com/souravdasbiswas/linkedin-mcp-server.git
cd linkedin-mcp-server
npm install
npm run build
```

### 2. Configure Your MCP Client

**For Claude Code** (recommended):

```bash
claude mcp add linkedin \
  -e LINKEDIN_CLIENT_ID=your_client_id \
  -e LINKEDIN_CLIENT_SECRET=your_client_secret \
  -- node /path/to/linkedin-mcp-server/dist/index.js
```

Or add manually to `~/.claude.json`:

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

**For Claude Desktop**, add to `claude_desktop_config.json`:

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

Replace `your_client_id` and `your_client_secret` with the values from Step 2.

### 3. Authenticate

Once connected, tell your AI assistant:

> "Authenticate with LinkedIn"

The assistant will generate an OAuth URL. Here's what happens:

1. Open the URL in your browser
2. Sign in to LinkedIn and click **Allow** to authorize the app
3. LinkedIn redirects to `http://localhost:3000/callback?code=XXX&state=YYY`
4. Since there's no local server listening, you'll see a "page not found" error - **that's expected**
5. Copy the full URL from your browser's address bar and paste it back to the assistant
6. The assistant extracts the `code` and `state` parameters and completes authentication

After the first authentication, your session persists across server restarts (token is valid for 60 days). You only need to re-authenticate when the token expires.

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
