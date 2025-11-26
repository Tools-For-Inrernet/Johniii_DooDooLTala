/**
 * Webvisor API Routes
 * @module routes/webvisor
 */

/**
 * Creates webvisor route handlers
 * @param {import('../storage/SessionStore.js').SessionStore} sessionStore
 * @returns {object}
 */
export function createWebvisorRoutes(sessionStore) {
  return {
    /**
     * POST /api/webvisor/events - Receive event batches
     * @param {Request} req
     * @returns {Response}
     */
    async postEvents(req) {
      try {
        const body = await req.json();
        const { sessionId, events, meta } = body;

        if (!sessionId || !events || !Array.isArray(events)) {
          return new Response(
            JSON.stringify({ error: 'Invalid request body' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        await sessionStore.storeEvents(sessionId, events, meta);

        return new Response(
          JSON.stringify({ success: true, eventsReceived: events.length }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('[Webvisor API] Error storing events:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    },

    /**
     * GET /api/webvisor/sessions - List sessions
     * @param {Request} req
     * @returns {Response}
     */
    async listSessions(req) {
      try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        const offset = parseInt(url.searchParams.get('offset') || '0', 10);

        const result = await sessionStore.listSessions({ limit, offset });

        return new Response(
          JSON.stringify(result),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('[Webvisor API] Error listing sessions:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    },

    /**
     * GET /api/webvisor/sessions/:id - Get session details
     * @param {Request} req
     * @param {string} sessionId
     * @returns {Response}
     */
    async getSession(req, sessionId) {
      try {
        const session = await sessionStore.getSession(sessionId);

        if (!session) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        return new Response(
          JSON.stringify(session),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('[Webvisor API] Error getting session:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    },

    /**
     * DELETE /api/webvisor/sessions/:id - Delete session
     * @param {Request} req
     * @param {string} sessionId
     * @returns {Response}
     */
    async deleteSession(req, sessionId) {
      try {
        const deleted = await sessionStore.deleteSession(sessionId);

        if (!deleted) {
          return new Response(
            JSON.stringify({ error: 'Session not found' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('[Webvisor API] Error deleting session:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
  };
}

export default createWebvisorRoutes;
