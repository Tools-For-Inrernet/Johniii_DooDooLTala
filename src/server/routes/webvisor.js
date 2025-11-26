/**
 * Webvisor API Routes
 * @module routes/webvisor
 */

/**
 * Creates webvisor route handlers
 * @param {import('../storage/PostgresStore.js').PostgresStore} store
 * @returns {object}
 */
export function createWebvisorRoutes(store) {
  return {
    /**
     * POST /api/webvisor/events - Receive event batches
     * @param {object} body
     * @returns {Promise<{status: number, data: object}>}
     */
    async postEvents(body) {
      try {
        const { sessionId, events, meta, clientIP } = body;

        if (!sessionId || !events || !Array.isArray(events)) {
          return {
            status: 400,
            data: { error: 'Invalid request body' }
          };
        }

        await store.storeEvents(sessionId, events, meta, clientIP);

        return {
          status: 200,
          data: { success: true, eventsReceived: events.length }
        };
      } catch (error) {
        console.error('[Webvisor API] Error storing events:', error);
        return {
          status: 500,
          data: { error: 'Internal server error' }
        };
      }
    },

    /**
     * GET /api/webvisor/sessions - List sessions
     * @param {object} options
     * @returns {Promise<{status: number, data: object}>}
     */
    async listSessions(options = {}) {
      try {
        const result = await store.listSessions(options);
        return {
          status: 200,
          data: result
        };
      } catch (error) {
        console.error('[Webvisor API] Error listing sessions:', error);
        return {
          status: 500,
          data: { error: 'Internal server error' }
        };
      }
    },

    /**
     * GET /api/webvisor/sessions/:id - Get session details
     * @param {string} sessionId
     * @returns {Promise<{status: number, data: object}>}
     */
    async getSession(sessionId) {
      try {
        const session = await store.getSession(sessionId);

        if (!session) {
          return {
            status: 404,
            data: { error: 'Session not found' }
          };
        }

        return {
          status: 200,
          data: session
        };
      } catch (error) {
        console.error('[Webvisor API] Error getting session:', error);
        return {
          status: 500,
          data: { error: 'Internal server error' }
        };
      }
    },

    /**
     * DELETE /api/webvisor/sessions/:id - Delete session
     * @param {string} sessionId
     * @returns {Promise<{status: number, data: object}>}
     */
    async deleteSession(sessionId) {
      try {
        const deleted = await store.deleteSession(sessionId);

        if (!deleted) {
          return {
            status: 404,
            data: { error: 'Session not found' }
          };
        }

        return {
          status: 200,
          data: { success: true }
        };
      } catch (error) {
        console.error('[Webvisor API] Error deleting session:', error);
        return {
          status: 500,
          data: { error: 'Internal server error' }
        };
      }
    },

    /**
     * GET /api/webvisor/visitors - List unique visitors
     * @returns {Promise<{status: number, data: object}>}
     */
    async listVisitors() {
      try {
        const result = await store.listVisitors();
        return {
          status: 200,
          data: result
        };
      } catch (error) {
        console.error('[Webvisor API] Error listing visitors:', error);
        return {
          status: 500,
          data: { error: 'Internal server error' }
        };
      }
    }
  };
}

export default createWebvisorRoutes;
