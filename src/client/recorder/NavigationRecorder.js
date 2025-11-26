/**
 * Navigation Recorder - Captures page transitions and URL changes
 * @module NavigationRecorder
 */

import { EventType } from '../../shared/constants.js';

/**
 * NavigationRecorder class - Records navigation events
 */
export class NavigationRecorder {
  /**
   * @param {object} options
   * @param {Function} options.onEvent - Callback for recorded events
   * @param {RegExp[]} options.excludePages - URL patterns to exclude
   */
  constructor(options = {}) {
    this.onEvent = options.onEvent || (() => {});
    this.excludePages = options.excludePages || [];
    this.currentUrl = '';
    this.handlers = {};
    this.isRecording = false;
  }

  /**
   * Checks if current page should be excluded from recording
   * @param {string} url
   * @returns {boolean}
   */
  isExcludedPage(url) {
    return this.excludePages.some(pattern => pattern.test(url));
  }

  /**
   * Records initial page load event
   */
  recordPageLoad() {
    this.currentUrl = window.location.href;

    if (this.isExcludedPage(this.currentUrl)) return;

    this.onEvent({
      type: EventType.PAGE_LOAD,
      timestamp: Date.now(),
      data: {
        url: this.currentUrl,
        title: document.title,
        referrer: document.referrer,
        timing: this.getNavigationTiming()
      }
    });
  }

  /**
   * Gets navigation timing data if available
   * @returns {object|null}
   */
  getNavigationTiming() {
    if (!window.performance?.timing) return null;

    const timing = performance.timing;
    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      loadComplete: timing.loadEventEnd - timing.navigationStart,
      firstPaint: this.getFirstPaint()
    };
  }

  /**
   * Gets first paint timing
   * @returns {number|null}
   */
  getFirstPaint() {
    if (!window.performance?.getEntriesByType) return null;

    const paintEntries = performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? Math.round(firstPaint.startTime) : null;
  }

  /**
   * Starts recording navigation events
   */
  start() {
    if (this.isRecording) return;
    this.isRecording = true;

    // Popstate handler (browser back/forward)
    this.handlers.popstate = () => {
      this.recordTransition('popstate');
    };

    // History API overrides for SPA navigation
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      this.originalPushState(...args);
      this.recordTransition('pushState');
    };

    history.replaceState = (...args) => {
      this.originalReplaceState(...args);
      this.recordTransition('replaceState');
    };

    // Hashchange handler
    this.handlers.hashchange = () => {
      this.recordTransition('hashchange');
    };

    // Beforeunload handler
    this.handlers.beforeunload = () => {
      this.onEvent({
        type: EventType.SESSION_END,
        timestamp: Date.now(),
        data: {
          url: window.location.href,
          reason: 'beforeunload'
        }
      });
    };

    // Visibility change handler
    this.handlers.visibilitychange = () => {
      if (document.visibilityState === 'hidden') {
        this.onEvent({
          type: EventType.PAGE_TRANSITION,
          timestamp: Date.now(),
          data: {
            action: 'hidden',
            url: window.location.href
          }
        });
      }
    };

    window.addEventListener('popstate', this.handlers.popstate);
    window.addEventListener('hashchange', this.handlers.hashchange);
    window.addEventListener('beforeunload', this.handlers.beforeunload);
    document.addEventListener('visibilitychange', this.handlers.visibilitychange);
  }

  /**
   * Records a page transition
   * @param {string} trigger
   */
  recordTransition(trigger) {
    const newUrl = window.location.href;

    if (newUrl === this.currentUrl) return;
    if (this.isExcludedPage(newUrl)) return;

    const previousUrl = this.currentUrl;
    this.currentUrl = newUrl;

    this.onEvent({
      type: EventType.PAGE_TRANSITION,
      timestamp: Date.now(),
      data: {
        trigger: trigger,
        from: previousUrl,
        to: newUrl,
        title: document.title
      }
    });
  }

  /**
   * Stops recording navigation events
   */
  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    window.removeEventListener('popstate', this.handlers.popstate);
    window.removeEventListener('hashchange', this.handlers.hashchange);
    window.removeEventListener('beforeunload', this.handlers.beforeunload);
    document.removeEventListener('visibilitychange', this.handlers.visibilitychange);

    // Restore original history methods
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }

    this.handlers = {};
  }
}
