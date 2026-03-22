/**
 * OAuth 2.0 manager for LinkedIn authentication.
 * Handles authorization URL generation, token exchange, refresh, and revocation.
 * Supports PKCE for enhanced security.
 */

import { randomBytes } from 'node:crypto';
import { generatePkceChallenge } from './pkce.js';
import { TokenStore } from './token-store.js';
import type { LinkedInConfig, OAuthTokenResponse, StoredToken, LinkedInScope } from '../types/index.js';

export interface AuthorizationResult {
  authorizationUrl: string;
  state: string;
}

export class OAuth2Manager {
  private tokenStore: TokenStore;
  private config: LinkedInConfig;

  constructor(config: LinkedInConfig, tokenStore: TokenStore) {
    this.config = config;
    this.tokenStore = tokenStore;
  }

  /**
   * Generate the LinkedIn OAuth authorization URL with PKCE.
   */
  getAuthorizationUrl(scopes?: LinkedInScope[]): AuthorizationResult {
    const state = randomBytes(32).toString('hex');
    const pkce = generatePkceChallenge();
    const effectiveScopes = scopes ?? this.config.scopes;

    this.tokenStore.savePkceState(state, pkce.codeVerifier, effectiveScopes);
    this.tokenStore.cleanExpiredPkceStates();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: effectiveScopes.join(' '),
      code_challenge: pkce.codeChallenge,
      code_challenge_method: pkce.codeChallengeMethod,
    });

    const authorizationUrl = `${this.config.authBaseUrl}/authorization?${params.toString()}`;
    return { authorizationUrl, state };
  }

  /**
   * Exchange authorization code for access token.
   */
  async handleCallback(code: string, state: string): Promise<StoredToken> {
    const pkceState = this.tokenStore.getPkceState(state);
    if (!pkceState) {
      throw new Error('Invalid or expired OAuth state. Please restart the authorization flow.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code_verifier: pkceState.codeVerifier,
    });

    const response = await fetch(`${this.config.authBaseUrl}/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed (${response.status}): ${error}`);
    }

    const tokenResponse = (await response.json()) as OAuthTokenResponse;

    // Fetch user info to get the user ID
    const userId = await this.fetchUserId(tokenResponse.access_token);

    const storedToken: StoredToken = {
      userId,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      scopes: tokenResponse.scope.split(' '),
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      refreshTokenExpiresAt: tokenResponse.refresh_token_expires_in
        ? Date.now() + tokenResponse.refresh_token_expires_in * 1000
        : undefined,
      createdAt: Date.now(),
    };

    this.tokenStore.save(storedToken);
    this.tokenStore.deletePkceState(state);

    return storedToken;
  }

  /**
   * Get a valid access token, refreshing if necessary.
   */
  async getAccessToken(userId: string): Promise<string> {
    const token = this.tokenStore.get(userId);
    if (!token) {
      throw new Error(
        'No token found. Please authenticate first using the linkedin_auth_start tool.',
      );
    }

    if (!this.tokenStore.isExpired(userId)) {
      return token.accessToken;
    }

    // Try refresh if we have a refresh token
    if (token.refreshToken) {
      try {
        return await this.refreshToken(userId, token.refreshToken);
      } catch {
        throw new Error(
          'Token expired and refresh failed. Please re-authenticate using linkedin_auth_start.',
        );
      }
    }

    throw new Error(
      'Token expired. Please re-authenticate using the linkedin_auth_start tool.',
    );
  }

  /**
   * Refresh an expired access token.
   */
  private async refreshToken(userId: string, refreshToken: string): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(`${this.config.authBaseUrl}/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const tokenResponse = (await response.json()) as OAuthTokenResponse;

    const storedToken: StoredToken = {
      userId,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? refreshToken,
      scopes: tokenResponse.scope.split(' '),
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      refreshTokenExpiresAt: tokenResponse.refresh_token_expires_in
        ? Date.now() + tokenResponse.refresh_token_expires_in * 1000
        : undefined,
      createdAt: Date.now(),
    };

    this.tokenStore.save(storedToken);
    return storedToken.accessToken;
  }

  /**
   * Revoke the current access token.
   */
  async revokeToken(userId: string): Promise<void> {
    const token = this.tokenStore.get(userId);
    if (!token) return;

    try {
      await fetch(`${this.config.authBaseUrl}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          token: token.accessToken,
        }).toString(),
      });
    } finally {
      this.tokenStore.delete(userId);
    }
  }

  /**
   * Get the scopes granted to a user.
   */
  getGrantedScopes(userId: string): string[] {
    const token = this.tokenStore.get(userId);
    return token?.scopes ?? [];
  }

  /**
   * Check if user has a valid (non-expired) token.
   */
  isAuthenticated(userId: string): boolean {
    return !this.tokenStore.isExpired(userId);
  }

  /**
   * Fetch the user's LinkedIn ID using the userinfo endpoint.
   */
  private async fetchUserId(accessToken: string): Promise<string> {
    const response = await fetch(`${this.config.apiBaseUrl}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const data = (await response.json()) as { sub: string };
    return data.sub;
  }
}
