/**
 * Webvisor - Main session recording module
 * @module Webvisor
 */

import { EventType, DEFAULT_CONFIG } from '../shared/constants.js';
import { DOMRecorder } from './recorder/DOMRecorder.js';
import { InteractionRecorder } from './recorder/InteractionRecorder.js';
import { InputRecorder } from './recorder/InputRecorder.js';
import { NavigationRecorder } from './recorder/NavigationRecorder.js';

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
  }

  /**
   * Determines if this session should be recorded based on sampling rate
   * @returns {boolean}
   */
  shouldSample() {
    // Check localStorage for existing sample decision for this user
    const storageKey = 'wv_sampled';
    const storedDecision = localStorage.getItem(storageKey);

    if (storedDecision !== null) {
      return storedDecision === 'true';
    }

    // Make new sampling decision
    const sampled = Math.random() * 100 < this.config.samplingRate;
    localStorage.setItem(storageKey, sampled.toString());
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
          meta: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screen: {
              width: screen.width,
              height: screen.height
            }
          }
        }),
        keepalive: true
      });

      if (!response.ok) {
        // Re-queue events on failure
        this.sendQueue.unshift(...batch);
        console.warn('[Webvisor] Failed to send batch:', response.status);
      }
    } catch (error) {
      // Re-queue events on error
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

    this.sessionId = generateSessionId();
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
        referrer: document.referrer
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

    console.log(`[Webvisor] Recording started - Session: ${this.sessionId}`);
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

    console.log(`[Webvisor] Recording stopped - ${this.events.length} events recorded`);
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
   * Checks if currently recording
   * @returns {boolean}
   */
  isActive() {
    return this.isRecording;
  }
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.Webvisor = Webvisor;
}

export default Webvisor;
