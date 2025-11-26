/**
 * Webvisor - Main session recording module
 * Auto-starts on DOM load, uses localStorage for persistence
 * @module Webvisor
 */

import { EventType, DEFAULT_CONFIG } from '../shared/constants.js';
import { DOMRecorder } from './recorder/DOMRecorder.js';
import { InteractionRecorder } from './recorder/InteractionRecorder.js';
import { InputRecorder } from './recorder/InputRecorder.js';
import { NavigationRecorder } from './recorder/NavigationRecorder.js';

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  SESSION_ID: 'wv_session_id',
  VISITOR_ID: 'wv_visitor_id',
  SAMPLED: 'wv_sampled',
  FINGERPRINT: 'wv_fingerprint'
};

/**
 * Cookie utility functions
 */
const Cookie = {
  set(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  },

  get(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },

  delete(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
};

/**
 * Storage utility - uses localStorage with cookie fallback
 */
const Storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      Cookie.set(key, value);
    }
  },

  get(key) {
    try {
      return localStorage.getItem(key) || Cookie.get(key);
    } catch (e) {
      return Cookie.get(key);
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
    Cookie.delete(key);
  }
};

/**
 * Generates a unique session ID
 * @returns {string}
 */
function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `wv_${timestamp}_${random}`;
}

/**
 * Generates a visitor fingerprint based on screen size and other factors
 * @returns {string}
 */
function generateFingerprint() {
  const data = [
    screen.width,
    screen.height,
    screen.colorDepth,
    navigator.language,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.maxTouchPoints || 0
  ].join('|');

  // Simple hash
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return 'fp_' + Math.abs(hash).toString(36);
}

/**
 * Gets or creates a persistent visitor ID
 * @returns {string}
 */
function getVisitorId() {
  let visitorId = Storage.get(STORAGE_KEYS.VISITOR_ID);

  if (!visitorId) {
    visitorId = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
    Storage.set(STORAGE_KEYS.VISITOR_ID, visitorId);
  }

  return visitorId;
}

/**
 * Gets or creates a fingerprint
 * @returns {string}
 */
function getFingerprint() {
  let fingerprint = Storage.get(STORAGE_KEYS.FINGERPRINT);

  if (!fingerprint) {
    fingerprint = generateFingerprint();
    Storage.set(STORAGE_KEYS.FINGERPRINT, fingerprint);
  }

  return fingerprint;
}

/**
 * Webvisor class - Main entry point for session recording
 */
export class Webvisor {
  /**
   * @param {object} config
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.config.privacy = { ...DEFAULT_CONFIG.privacy, ...config.privacy };

    this.sessionId = null;
    this.visitorId = null;
    this.fingerprint = null;
    this.events = [];
    this.isRecording = false;
    this.isSampled = false;

    // Initialize recorders
    this.domRecorder = null;
    this.interactionRecorder = null;
    this.inputRecorder = null;
    this.navigationRecorder = null;

    // Batch sending
    this.batchTimer = null;
    this.sendQueue = [];

    // Auto-start if configured
    if (this.config.autoStart !== false) {
      this.autoStart();
    }
  }

  /**
   * Auto-starts recording when DOM is ready
   */
  autoStart() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      // DOM already loaded
      this.start();
    }
  }

  /**
   * Determines if this session should be recorded based on sampling rate
   * @returns {boolean}
   */
  shouldSample() {
    const storedDecision = Storage.get(STORAGE_KEYS.SAMPLED);

    if (storedDecision !== null) {
      return storedDecision === 'true';
    }

    const sampled = Math.random() * 100 < this.config.samplingRate;
    Storage.set(STORAGE_KEYS.SAMPLED, sampled.toString());
    return sampled;
  }

  /**
   * Checks if current page should be excluded
   * @returns {boolean}
   */
  isPageExcluded() {
    const url = window.location.href;
    const patterns = this.config.privacy.excludePages;

    return patterns.some(pattern => {
      if (typeof pattern === 'string') {
        return new RegExp(pattern).test(url);
      }
      return pattern.test(url);
    });
  }

  /**
   * Gets metadata about the current session
   * @returns {object}
   */
  getMetadata() {
    return {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: screen.width,
        height: screen.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      fingerprint: this.fingerprint,
      visitorId: this.visitorId
    };
  }

  /**
   * Handles recorded events
   * @param {object} event
   */
  handleEvent(event) {
    if (!this.isRecording) return;

    event.sessionId = this.sessionId;
    this.events.push(event);

    // Add to send queue
    this.sendQueue.push(event);

    // Check if we should send batch
    if (this.sendQueue.length >= this.config.batchSize) {
      this.sendBatch();
    }
  }

  /**
   * Sends a batch of events to the server
   */
  async sendBatch() {
    if (this.sendQueue.length === 0) return;

    const batch = this.sendQueue.splice(0, this.config.batchSize);
    const meta = this.getMetadata();

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          events: batch,
          timestamp: Date.now(),
          meta
        }),
        keepalive: true
      });

      if (!response.ok) {
        this.sendQueue.unshift(...batch);
        console.warn('[Webvisor] Failed to send batch:', response.status);
      }
    } catch (error) {
      this.sendQueue.unshift(...batch);
      console.warn('[Webvisor] Error sending batch:', error.message);
    }
  }

  /**
   * Starts the batch send timer
   */
  startBatchTimer() {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      this.sendBatch();
    }, this.config.batchInterval);
  }

  /**
   * Stops the batch send timer
   */
  stopBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Initializes and starts recording
   * @returns {boolean} Whether recording was started
   */
  start() {
    if (this.isRecording) {
      console.warn('[Webvisor] Already recording');
      return false;
    }

    // Check if page is excluded
    if (this.isPageExcluded()) {
      console.log('[Webvisor] Page excluded from recording');
      return false;
    }

    // Check sampling
    this.isSampled = this.shouldSample();
    if (!this.isSampled) {
      console.log('[Webvisor] Session not sampled');
      return false;
    }

    // Get or create session ID
    this.sessionId = Storage.get(STORAGE_KEYS.SESSION_ID);
    if (!this.sessionId) {
      this.sessionId = generateSessionId();
      Storage.set(STORAGE_KEYS.SESSION_ID, this.sessionId);
    }

    // Get visitor ID and fingerprint
    this.visitorId = getVisitorId();
    this.fingerprint = getFingerprint();

    this.isRecording = true;

    const eventHandler = this.handleEvent.bind(this);
    const excludeAttribute = this.config.privacy.excludeAttribute;

    // Initialize DOM recorder
    this.domRecorder = new DOMRecorder({
      onEvent: eventHandler,
      excludeAttribute
    });

    // Initialize interaction recorder
    this.interactionRecorder = new InteractionRecorder({
      onEvent: eventHandler,
      mouseThrottle: this.config.mouseThrottle,
      scrollThrottle: this.config.scrollThrottle,
      excludeAttribute
    });

    // Initialize input recorder
    this.inputRecorder = new InputRecorder({
      onEvent: eventHandler,
      maskAllInputs: this.config.privacy.maskAllInputs,
      maskSensitiveInputs: this.config.privacy.maskSensitiveInputs,
      excludeAttribute
    });

    // Initialize navigation recorder
    const excludePatterns = this.config.privacy.excludePages.map(p =>
      typeof p === 'string' ? new RegExp(p) : p
    );
    this.navigationRecorder = new NavigationRecorder({
      onEvent: eventHandler,
      excludePages: excludePatterns
    });

    // Record session start
    this.handleEvent({
      type: EventType.SESSION_START,
      timestamp: Date.now(),
      data: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        fingerprint: this.fingerprint,
        visitorId: this.visitorId
      }
    });

    // Capture initial DOM snapshot
    this.domRecorder.captureSnapshot();

    // Start all recorders
    this.domRecorder.start();
    this.interactionRecorder.start();
    this.inputRecorder.start();
    this.navigationRecorder.start();
    this.navigationRecorder.recordPageLoad();

    // Start batch timer
    this.startBatchTimer();

    // Send on page unload
    window.addEventListener('beforeunload', () => {
      this.sendBatch();
    });

    // Send on visibility change (mobile background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendBatch();
      }
    });

    console.log(`[Webvisor] Recording started - Session: ${this.sessionId}, Fingerprint: ${this.fingerprint}`);
    return true;
  }

  /**
   * Stops recording and sends remaining events
   */
  async stop() {
    if (!this.isRecording) return;

    this.isRecording = false;

    // Record session end
    this.handleEvent({
      type: EventType.SESSION_END,
      timestamp: Date.now(),
      data: {
        url: window.location.href,
        eventsRecorded: this.events.length
      }
    });

    // Stop all recorders
    this.domRecorder?.stop();
    this.interactionRecorder?.stop();
    this.inputRecorder?.stop();
    this.navigationRecorder?.stop();

    // Stop batch timer and send remaining events
    this.stopBatchTimer();
    await this.sendBatch();

    // Clear session ID for new session on next visit
    Storage.remove(STORAGE_KEYS.SESSION_ID);

    console.log(`[Webvisor] Recording stopped - ${this.events.length} events recorded`);
  }

  /**
   * Clears all stored data
   */
  clearStorage() {
    Object.values(STORAGE_KEYS).forEach(key => Storage.remove(key));
  }

  /**
   * Gets recorded events (for debugging)
   * @returns {object[]}
   */
  getEvents() {
    return [...this.events];
  }

  /**
   * Gets current session ID
   * @returns {string|null}
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Gets visitor fingerprint
   * @returns {string|null}
   */
  getFingerprint() {
    return this.fingerprint;
  }

  /**
   * Gets visitor ID
   * @returns {string|null}
   */
  getVisitorId() {
    return this.visitorId;
  }

  /**
   * Checks if currently recording
   * @returns {boolean}
   */
  isActive() {
    return this.isRecording;
  }
}

// Auto-initialize with default config if script has data-webvisor-auto attribute
if (typeof window !== 'undefined') {
  window.Webvisor = Webvisor;

  // Check for auto-init
  const autoScript = document.currentScript || document.querySelector('script[data-webvisor-auto]');
  if (autoScript?.hasAttribute('data-webvisor-auto')) {
    const config = {};

    if (autoScript.dataset.endpoint) {
      config.endpoint = autoScript.dataset.endpoint;
    }
    if (autoScript.dataset.samplingRate) {
      config.samplingRate = parseInt(autoScript.dataset.samplingRate, 10);
    }

    window.__webvisor = new Webvisor(config);
  }
}

export default Webvisor;
