/**
 * Local post history tracker.
 * Stores metadata for posts created through this MCP server
 * so they can be listed, referenced, and deleted later.
 */

import type Database from 'better-sqlite3';

export interface PostRecord {
  postUrn: string;
  textPreview: string;
  visibility: string;
  hasImage: boolean;
  hasArticle: boolean;
  articleUrl?: string;
  createdAt: number;
}

export class PostHistory {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS post_history (
        post_urn TEXT PRIMARY KEY,
        text_preview TEXT NOT NULL,
        visibility TEXT NOT NULL,
        has_image INTEGER NOT NULL DEFAULT 0,
        has_article INTEGER NOT NULL DEFAULT 0,
        article_url TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }

  save(record: PostRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO post_history
        (post_urn, text_preview, visibility, has_image, has_article, article_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.postUrn,
      record.textPreview.substring(0, 200),
      record.visibility,
      record.hasImage ? 1 : 0,
      record.hasArticle ? 1 : 0,
      record.articleUrl ?? null,
      record.createdAt,
    );
  }

  remove(postUrn: string): void {
    this.db.prepare('DELETE FROM post_history WHERE post_urn = ?').run(postUrn);
  }

  list(limit = 20): PostRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM post_history ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      postUrn: row.post_urn as string,
      textPreview: row.text_preview as string,
      visibility: row.visibility as string,
      hasImage: (row.has_image as number) === 1,
      hasArticle: (row.has_article as number) === 1,
      articleUrl: (row.article_url as string) ?? undefined,
      createdAt: row.created_at as number,
    }));
  }

  get(postUrn: string): PostRecord | null {
    const row = this.db
      .prepare('SELECT * FROM post_history WHERE post_urn = ?')
      .get(postUrn) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      postUrn: row.post_urn as string,
      textPreview: row.text_preview as string,
      visibility: row.visibility as string,
      hasImage: (row.has_image as number) === 1,
      hasArticle: (row.has_article as number) === 1,
      articleUrl: (row.article_url as string) ?? undefined,
      createdAt: row.created_at as number,
    };
  }

  count(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM post_history')
      .get() as { cnt: number };
    return row.cnt;
  }
}
