/**
 * SQLite-backed token persistence.
 * Stores OAuth tokens securely with automatic expiry tracking.
 */

import Database from 'better-sqlite3';
import type { StoredToken } from '../types/index.js';

export class TokenStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        scopes TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        refresh_token_expires_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pkce_state (
        state TEXT PRIMARY KEY,
        code_verifier TEXT NOT NULL,
        scopes TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
  }

  save(token: StoredToken): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tokens
        (user_id, access_token, refresh_token, scopes, expires_at, refresh_token_expires_at, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      token.userId,
      token.accessToken,
      token.refreshToken ?? null,
      JSON.stringify(token.scopes),
      token.expiresAt,
      token.refreshTokenExpiresAt ?? null,
      token.createdAt,
    );
  }

  get(userId: string): StoredToken | null {
    const row = this.db.prepare('SELECT * FROM tokens WHERE user_id = ?').get(userId) as
      | Record<string, unknown>
      | undefined;

    if (!row) return null;

    return {
      userId: row.user_id as string,
      accessToken: row.access_token as string,
      refreshToken: (row.refresh_token as string) ?? undefined,
      scopes: JSON.parse(row.scopes as string) as string[],
      expiresAt: row.expires_at as number,
      refreshTokenExpiresAt: (row.refresh_token_expires_at as number) ?? undefined,
      createdAt: row.created_at as number,
    };
  }

  delete(userId: string): void {
    this.db.prepare('DELETE FROM tokens WHERE user_id = ?').run(userId);
  }

  isExpired(userId: string): boolean {
    const token = this.get(userId);
    if (!token) return true;
    // Consider expired 5 minutes before actual expiry for safety
    return Date.now() >= token.expiresAt - 5 * 60 * 1000;
  }

  // PKCE state management

  savePkceState(state: string, codeVerifier: string, scopes: string[]): void {
    this.db.prepare(`
      INSERT INTO pkce_state (state, code_verifier, scopes, created_at)
      VALUES (?, ?, ?, ?)
    `).run(state, codeVerifier, JSON.stringify(scopes), Date.now());
  }

  getPkceState(state: string): { codeVerifier: string; scopes: string[] } | null {
    const row = this.db
      .prepare('SELECT * FROM pkce_state WHERE state = ?')
      .get(state) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      codeVerifier: row.code_verifier as string,
      scopes: JSON.parse(row.scopes as string) as string[],
    };
  }

  deletePkceState(state: string): void {
    this.db.prepare('DELETE FROM pkce_state WHERE state = ?').run(state);
  }

  cleanExpiredPkceStates(): void {
    // Remove PKCE states older than 30 minutes
    const cutoff = Date.now() - 30 * 60 * 1000;
    this.db.prepare('DELETE FROM pkce_state WHERE created_at < ?').run(cutoff);
  }

  close(): void {
    this.db.close();
  }
}
