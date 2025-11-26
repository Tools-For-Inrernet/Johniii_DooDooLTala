/**
 * Session Store - Handles storage and retrieval of webvisor sessions
 * Uses file-based storage with JSON for simplicity
 * @module SessionStore
 */

import { mkdir, readFile, writeFile, readdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * SessionStore class - Manages session data persistence
 */
export class SessionStore {
  /**
   * @param {object} options
   * @param {string} options.storagePath - Path to store session files
   * @param {number} options.retentionDays - Days to retain sessions
   */
  constructor(options = {}) {
    this.storagePath = options.storagePath || './data/sessions';
    this.retentionDays = options.retentionDays || 15;
    this.initialized = false;
  }

  /**
   * Initializes the storage directory
   */
  async init() {
    if (this.initialized) return;

    if (!existsSync(this.storagePath)) {
      await mkdir(this.storagePath, { recursive: true });
    }

    this.initialized = true;

    // Start cleanup interval (run every hour)
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => {
        console.error('[SessionStore] Cleanup error:', err);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Gets the file path for a session
   * @param {string} sessionId
   * @returns {string}
   */
  getSessionPath(sessionId) {
    // Sanitize session ID to prevent path traversal
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
    return join(this.storagePath, `${safeId}.json`);
  }

  /**
   * Stores events for a session
   * @param {string} sessionId
   * @param {object[]} events
   * @param {object} meta
   */
  async storeEvents(sessionId, events, meta = {}) {
    await this.init();

    const filePath = this.getSessionPath(sessionId);
    let session;

    try {
      const existing = await readFile(filePath, 'utf-8');
      session = JSON.parse(existing);
      session.events.push(...events);
      session.updatedAt = Date.now();
    } catch (error) {
      // New session
      session = {
        sessionId,
        meta,
        events,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    await writeFile(filePath, JSON.stringify(session), 'utf-8');
    return session;
  }

  /**
   * Retrieves a session by ID
   * @param {string} sessionId
   * @returns {object|null}
   */
  async getSession(sessionId) {
    await this.init();

    const filePath = this.getSessionPath(sessionId);

    try {
      const data = await readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Lists all sessions with pagination
   * @param {object} options
   * @param {number} options.limit
   * @param {number} options.offset
   * @returns {object}
   */
  async listSessions(options = {}) {
    await this.init();

    const { limit = 50, offset = 0 } = options;

    try {
      const files = await readdir(this.storagePath);
      const sessionFiles = files.filter(f => f.endsWith('.json'));

      // Get file stats for sorting by modification time
      const sessions = await Promise.all(
        sessionFiles.map(async (file) => {
          const filePath = join(this.storagePath, file);
          const fileStat = await stat(filePath);
          return {
            sessionId: file.replace('.json', ''),
            updatedAt: fileStat.mtime.getTime(),
            size: fileStat.size
          };
        })
      );

      // Sort by updatedAt descending
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);

      const paginated = sessions.slice(offset, offset + limit);

      return {
        sessions: paginated,
        total: sessions.length,
        limit,
        offset
      };
    } catch (error) {
      console.error('[SessionStore] List error:', error);
      return { sessions: [], total: 0, limit, offset };
    }
  }

  /**
   * Deletes a session
   * @param {string} sessionId
   * @returns {boolean}
   */
  async deleteSession(sessionId) {
    const filePath = this.getSessionPath(sessionId);

    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleans up expired sessions
   */
  async cleanup() {
    await this.init();

    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);

    try {
      const files = await readdir(this.storagePath);
      let deleted = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.storagePath, file);
        const fileStat = await stat(filePath);

        if (fileStat.mtime.getTime() < cutoff) {
          await unlink(filePath);
          deleted++;
        }
      }

      if (deleted > 0) {
        console.log(`[SessionStore] Cleaned up ${deleted} expired sessions`);
      }
    } catch (error) {
      console.error('[SessionStore] Cleanup error:', error);
    }
  }

  /**
   * Stops the cleanup interval
   */
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export default SessionStore;
