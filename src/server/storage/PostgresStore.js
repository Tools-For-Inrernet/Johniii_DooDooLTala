/**
 * PostgreSQL Store - Handles storage and retrieval of webvisor sessions
 * Auto-creates database and tables on initialization
 * @module PostgresStore
 */

import pg from 'pg';
const { Pool } = pg;

/**
 * PostgresStore class - Manages session data persistence with PostgreSQL
 */
export class PostgresStore {
  /**
   * @param {object} options
   * @param {string} options.host
   * @param {number} options.port
   * @param {string} options.database
   * @param {string} options.user
   * @param {string} options.password
   * @param {number} options.retentionDays
   */
  constructor(options = {}) {
    this.config = {
      host: options.host || 'localhost',
      port: options.port || 5432,
      database: options.database || 'webvisor',
      user: options.user || 'postgres',
      password: options.password || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };
    this.retentionDays = options.retentionDays || 15;
    this.pool = null;
    this.cleanupInterval = null;
  }

  /**
   * Initializes the database connection and creates tables
   */
  async init() {
    // First connect to 'postgres' database to create our database if needed
    const adminPool = new Pool({
      ...this.config,
      database: 'postgres'
    });

    try {
      // Check if database exists
      const dbCheck = await adminPool.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [this.config.database]
      );

      if (dbCheck.rows.length === 0) {
        // Create database
        await adminPool.query(`CREATE DATABASE ${this.config.database}`);
        console.log(`[PostgresStore] Created database: ${this.config.database}`);
      }
    } catch (error) {
      // Database might already exist or we don't have permission
      console.log(`[PostgresStore] Database check: ${error.message}`);
    } finally {
      await adminPool.end();
    }

    // Connect to our database
    this.pool = new Pool(this.config);

    // Test connection
    await this.pool.query('SELECT NOW()');

    // Create tables
    await this.createTables();

    // Start cleanup interval (run every hour)
    this.cleanupInterval = setInterval(() => {
      this.cleanup().catch(err => {
        console.error('[PostgresStore] Cleanup error:', err);
      });
    }, 60 * 60 * 1000);
  }

  /**
   * Creates necessary tables if they don't exist
   */
  async createTables() {
    const queries = [
      // Visitors table - stores unique visitors by fingerprint
      `CREATE TABLE IF NOT EXISTS visitors (
        id SERIAL PRIMARY KEY,
        fingerprint VARCHAR(64) UNIQUE NOT NULL,
        ip_address VARCHAR(45),
        screen_width INTEGER,
        screen_height INTEGER,
        user_agent TEXT,
        language VARCHAR(10),
        timezone VARCHAR(50),
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        visit_count INTEGER DEFAULT 1
      )`,

      // Sessions table - stores recording sessions
      `CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) UNIQUE NOT NULL,
        visitor_id INTEGER REFERENCES visitors(id),
        fingerprint VARCHAR(64),
        ip_address VARCHAR(45),
        url TEXT,
        title TEXT,
        referrer TEXT,
        user_agent TEXT,
        screen_width INTEGER,
        screen_height INTEGER,
        viewport_width INTEGER,
        viewport_height INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        event_count INTEGER DEFAULT 0
      )`,

      // Events table - stores individual events
      `CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        event_type INTEGER NOT NULL,
        timestamp BIGINT NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Create indexes for better query performance
      `CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON sessions(fingerprint)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_visitors_fingerprint ON visitors(fingerprint)`,
      `CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen)`
    ];

    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        // Index might already exist
        if (!error.message.includes('already exists')) {
          console.error('[PostgresStore] Table creation error:', error.message);
        }
      }
    }

    console.log('[PostgresStore] Tables and indexes created');
  }

  /**
   * Creates or updates a visitor record
   * @param {object} visitorData
   * @returns {Promise<number>} Visitor ID
   */
  async upsertVisitor(visitorData) {
    const { fingerprint, ipAddress, screenWidth, screenHeight, userAgent, language, timezone } = visitorData;

    const result = await this.pool.query(
      `INSERT INTO visitors (fingerprint, ip_address, screen_width, screen_height, user_agent, language, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (fingerprint) DO UPDATE SET
         ip_address = EXCLUDED.ip_address,
         last_seen = CURRENT_TIMESTAMP,
         visit_count = visitors.visit_count + 1
       RETURNING id`,
      [fingerprint, ipAddress, screenWidth, screenHeight, userAgent, language, timezone]
    );

    return result.rows[0].id;
  }

  /**
   * Stores events for a session
   * @param {string} sessionId
   * @param {object[]} events
   * @param {object} meta
   * @param {string} clientIP
   */
  async storeEvents(sessionId, events, meta = {}, clientIP = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Generate fingerprint from screen size + IP
      const fingerprint = this.generateFingerprint(meta, clientIP);

      // Upsert visitor
      let visitorId = null;
      if (fingerprint) {
        const visitorResult = await client.query(
          `INSERT INTO visitors (fingerprint, ip_address, screen_width, screen_height, user_agent, language, timezone)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (fingerprint) DO UPDATE SET
             ip_address = COALESCE(EXCLUDED.ip_address, visitors.ip_address),
             last_seen = CURRENT_TIMESTAMP,
             visit_count = visitors.visit_count + 1
           RETURNING id`,
          [
            fingerprint,
            clientIP,
            meta.screen?.width || null,
            meta.screen?.height || null,
            meta.userAgent || null,
            meta.language || null,
            meta.timezone || null
          ]
        );
        visitorId = visitorResult.rows[0].id;
      }

      // Check if session exists
      const sessionCheck = await client.query(
        'SELECT id FROM sessions WHERE session_id = $1',
        [sessionId]
      );

      if (sessionCheck.rows.length === 0) {
        // Create new session
        await client.query(
          `INSERT INTO sessions (
            session_id, visitor_id, fingerprint, ip_address, url, title, referrer,
            user_agent, screen_width, screen_height, viewport_width, viewport_height
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            sessionId,
            visitorId,
            fingerprint,
            clientIP,
            meta.url || null,
            meta.title || null,
            meta.referrer || null,
            meta.userAgent || null,
            meta.screen?.width || null,
            meta.screen?.height || null,
            meta.viewport?.width || null,
            meta.viewport?.height || null
          ]
        );
      }

      // Insert events
      for (const event of events) {
        await client.query(
          `INSERT INTO events (session_id, event_type, timestamp, data)
           VALUES ($1, $2, $3, $4)`,
          [sessionId, event.type, event.timestamp, JSON.stringify(event.data || {})]
        );
      }

      // Update session event count and timestamp
      await client.query(
        `UPDATE sessions SET
          event_count = event_count + $1,
          updated_at = CURRENT_TIMESTAMP
         WHERE session_id = $2`,
        [events.length, sessionId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generates a fingerprint from screen size and IP
   * @param {object} meta
   * @param {string} clientIP
   * @returns {string}
   */
  generateFingerprint(meta, clientIP) {
    const parts = [
      meta.screen?.width || 0,
      meta.screen?.height || 0,
      clientIP || 'unknown'
    ];

    // Simple hash function
    const str = parts.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(36);
  }

  /**
   * Retrieves a session by ID with all events
   * @param {string} sessionId
   * @returns {Promise<object|null>}
   */
  async getSession(sessionId) {
    const sessionResult = await this.pool.query(
      `SELECT s.*, v.visit_count, v.first_seen as visitor_first_seen
       FROM sessions s
       LEFT JOIN visitors v ON s.visitor_id = v.id
       WHERE s.session_id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const session = sessionResult.rows[0];

    const eventsResult = await this.pool.query(
      `SELECT event_type, timestamp, data
       FROM events
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    return {
      sessionId: session.session_id,
      fingerprint: session.fingerprint,
      ipAddress: session.ip_address,
      url: session.url,
      title: session.title,
      referrer: session.referrer,
      userAgent: session.user_agent,
      screen: {
        width: session.screen_width,
        height: session.screen_height
      },
      viewport: {
        width: session.viewport_width,
        height: session.viewport_height
      },
      eventCount: session.event_count,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      visitor: {
        visitCount: session.visit_count,
        firstSeen: session.visitor_first_seen
      },
      events: eventsResult.rows.map(e => ({
        type: e.event_type,
        timestamp: parseInt(e.timestamp),
        data: e.data
      }))
    };
  }

  /**
   * Lists sessions with pagination
   * @param {object} options
   * @returns {Promise<object>}
   */
  async listSessions(options = {}) {
    const { limit = 50, offset = 0 } = options;

    const countResult = await this.pool.query('SELECT COUNT(*) FROM sessions');
    const total = parseInt(countResult.rows[0].count);

    const sessionsResult = await this.pool.query(
      `SELECT s.session_id, s.fingerprint, s.ip_address, s.url, s.title,
              s.screen_width, s.screen_height, s.event_count,
              s.created_at, s.updated_at,
              v.visit_count
       FROM sessions s
       LEFT JOIN visitors v ON s.visitor_id = v.id
       ORDER BY s.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      sessions: sessionsResult.rows.map(s => ({
        sessionId: s.session_id,
        fingerprint: s.fingerprint,
        ipAddress: s.ip_address,
        url: s.url,
        title: s.title,
        screen: { width: s.screen_width, height: s.screen_height },
        eventCount: s.event_count,
        visitCount: s.visit_count,
        createdAt: s.created_at,
        updatedAt: s.updated_at
      })),
      total,
      limit,
      offset
    };
  }

  /**
   * Lists unique visitors
   * @returns {Promise<object>}
   */
  async listVisitors() {
    const result = await this.pool.query(
      `SELECT fingerprint, ip_address, screen_width, screen_height,
              user_agent, language, timezone, first_seen, last_seen, visit_count
       FROM visitors
       ORDER BY last_seen DESC
       LIMIT 100`
    );

    return {
      visitors: result.rows.map(v => ({
        fingerprint: v.fingerprint,
        ipAddress: v.ip_address,
        screen: { width: v.screen_width, height: v.screen_height },
        userAgent: v.user_agent,
        language: v.language,
        timezone: v.timezone,
        firstSeen: v.first_seen,
        lastSeen: v.last_seen,
        visitCount: v.visit_count
      })),
      total: result.rows.length
    };
  }

  /**
   * Deletes a session
   * @param {string} sessionId
   * @returns {Promise<boolean>}
   */
  async deleteSession(sessionId) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Delete events first
      await client.query('DELETE FROM events WHERE session_id = $1', [sessionId]);

      // Delete session
      const result = await client.query(
        'DELETE FROM sessions WHERE session_id = $1 RETURNING id',
        [sessionId]
      );

      await client.query('COMMIT');
      return result.rows.length > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Cleans up expired sessions
   */
  async cleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Get expired session IDs
      const expiredResult = await client.query(
        'SELECT session_id FROM sessions WHERE updated_at < $1',
        [cutoffDate]
      );

      if (expiredResult.rows.length > 0) {
        const sessionIds = expiredResult.rows.map(r => r.session_id);

        // Delete events
        await client.query(
          'DELETE FROM events WHERE session_id = ANY($1)',
          [sessionIds]
        );

        // Delete sessions
        await client.query(
          'DELETE FROM sessions WHERE session_id = ANY($1)',
          [sessionIds]
        );

        console.log(`[PostgresStore] Cleaned up ${sessionIds.length} expired sessions`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Closes the connection pool
   */
  async close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export default PostgresStore;
