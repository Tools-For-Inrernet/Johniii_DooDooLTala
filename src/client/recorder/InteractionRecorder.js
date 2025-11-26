/**
 * Interaction Recorder - Captures user interactions
 * @module InteractionRecorder
 */

import { EventType } from '../../shared/constants.js';
import { getSelector } from './DOMRecorder.js';

/**
 * Creates a throttled version of a function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function throttle(fn, delay) {
  let lastCall = 0;
  let timeoutId = null;

  return function throttled(...args) {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * InteractionRecorder class - Records user interactions
 */
export class InteractionRecorder {
  /**
   * @param {object} options
   * @param {Function} options.onEvent - Callback for recorded events
   * @param {number} options.mouseThrottle - Mouse move throttle in ms
   * @param {number} options.scrollThrottle - Scroll throttle in ms
   * @param {string} options.excludeAttribute - Attribute to mark excluded elements
   */
  constructor(options = {}) {
    this.onEvent = options.onEvent || (() => {});
    this.mouseThrottle = options.mouseThrottle || 50;
    this.scrollThrottle = options.scrollThrottle || 100;
    this.excludeAttribute = options.excludeAttribute || 'data-ym-disable';

    this.handlers = {};
    this.isRecording = false;
  }

  /**
   * Checks if an element should be excluded from recording
   * @param {Element} element
   * @returns {boolean}
   */
  isExcluded(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (current.hasAttribute(this.excludeAttribute)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  /**
   * Starts recording interactions
   */
  start() {
    if (this.isRecording) return;
    this.isRecording = true;

    // Mouse move handler (throttled)
    this.handlers.mouseMove = throttle((e) => {
      this.onEvent({
        type: EventType.MOUSE_MOVE,
        timestamp: Date.now(),
        data: {
          x: e.clientX,
          y: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY
        }
      });
    }, this.mouseThrottle);

    // Mouse click handler
    this.handlers.mouseClick = (e) => {
      const target = /** @type {Element} */ (e.target);

      if (this.isExcluded(target)) return;

      this.onEvent({
        type: EventType.MOUSE_CLICK,
        timestamp: Date.now(),
        data: {
          x: e.clientX,
          y: e.clientY,
          pageX: e.pageX,
          pageY: e.pageY,
          button: e.button,
          selector: getSelector(target),
          tagName: target.tagName,
          textContent: target.textContent?.slice(0, 50) || ''
        }
      });
    };

    // Scroll handler (throttled)
    this.handlers.scroll = throttle(() => {
      this.onEvent({
        type: EventType.SCROLL,
        timestamp: Date.now(),
        data: {
          x: window.pageXOffset,
          y: window.pageYOffset,
          maxX: document.documentElement.scrollWidth - window.innerWidth,
          maxY: document.documentElement.scrollHeight - window.innerHeight
        }
      });
    }, this.scrollThrottle);

    // Resize handler (throttled)
    this.handlers.resize = throttle(() => {
      this.onEvent({
        type: EventType.RESIZE,
        timestamp: Date.now(),
        data: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        }
      });
    }, 200);

    // Add event listeners
    document.addEventListener('mousemove', this.handlers.mouseMove, { passive: true });
    document.addEventListener('click', this.handlers.mouseClick, { capture: true });
    window.addEventListener('scroll', this.handlers.scroll, { passive: true });
    window.addEventListener('resize', this.handlers.resize, { passive: true });
  }

  /**
   * Stops recording interactions
   */
  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    document.removeEventListener('mousemove', this.handlers.mouseMove);
    document.removeEventListener('click', this.handlers.mouseClick, { capture: true });
    window.removeEventListener('scroll', this.handlers.scroll);
    window.removeEventListener('resize', this.handlers.resize);

    this.handlers = {};
  }
}

export { throttle };
