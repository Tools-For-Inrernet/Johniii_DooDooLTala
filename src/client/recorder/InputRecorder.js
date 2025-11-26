/**
 * Input Recorder - Captures input events with privacy controls
 * @module InputRecorder
 */

import { EventType, SENSITIVE_INPUT_TYPES, SENSITIVE_NAME_PATTERNS } from '../../shared/constants.js';
import { getSelector } from './DOMRecorder.js';

/**
 * InputRecorder class - Records input events with masking
 */
export class InputRecorder {
  /**
   * @param {object} options
   * @param {Function} options.onEvent - Callback for recorded events
   * @param {boolean} options.maskAllInputs - Mask all input values
   * @param {boolean} options.maskSensitiveInputs - Auto-mask sensitive inputs
   * @param {string} options.excludeAttribute - Attribute to mark excluded elements
   */
  constructor(options = {}) {
    this.onEvent = options.onEvent || (() => {});
    this.maskAllInputs = options.maskAllInputs || false;
    this.maskSensitiveInputs = options.maskSensitiveInputs !== false;
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
    if (!element) return false;

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
   * Determines if an input should be masked
   * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} element
   * @returns {boolean}
   */
  shouldMask(element) {
    if (this.maskAllInputs) {
      return true;
    }

    if (!this.maskSensitiveInputs) {
      return false;
    }

    // Check input type
    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      if (SENSITIVE_INPUT_TYPES.includes(inputType)) {
        return true;
      }

      // Check autocomplete attribute
      const autocomplete = element.autocomplete?.toLowerCase() || '';
      if (SENSITIVE_INPUT_TYPES.some(t => autocomplete.includes(t))) {
        return true;
      }
    }

    // Check name attribute against sensitive patterns
    const name = element.name || '';
    const id = element.id || '';
    const placeholder = element.placeholder || '';

    for (const pattern of SENSITIVE_NAME_PATTERNS) {
      if (pattern.test(name) || pattern.test(id) || pattern.test(placeholder)) {
        return true;
      }
    }

    // Check for explicit masking attribute
    if (element.hasAttribute('data-ym-mask')) {
      return true;
    }

    return false;
  }

  /**
   * Masks a value for privacy
   * @param {string} value
   * @returns {string}
   */
  maskValue(value) {
    if (!value) return '';
    return '*'.repeat(Math.min(value.length, 20));
  }

  /**
   * Starts recording input events
   */
  start() {
    if (this.isRecording) return;
    this.isRecording = true;

    // Input handler for text inputs
    this.handlers.input = (e) => {
      const target = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (e.target);

      if (!target || this.isExcluded(target)) return;

      const tagName = target.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') return;

      const isMasked = this.shouldMask(target);
      const value = isMasked ? this.maskValue(target.value) : target.value;

      this.onEvent({
        type: EventType.INPUT,
        timestamp: Date.now(),
        data: {
          selector: getSelector(target),
          tagName: tagName,
          inputType: target instanceof HTMLInputElement ? target.type : 'textarea',
          value: value,
          masked: isMasked,
          selectionStart: target.selectionStart,
          selectionEnd: target.selectionEnd
        }
      });
    };

    // Change handler for select elements and checkboxes/radios
    this.handlers.change = (e) => {
      const target = /** @type {HTMLSelectElement|HTMLInputElement} */ (e.target);

      if (!target || this.isExcluded(target)) return;

      const tagName = target.tagName;

      if (tagName === 'SELECT') {
        const select = /** @type {HTMLSelectElement} */ (target);
        this.onEvent({
          type: EventType.INPUT,
          timestamp: Date.now(),
          data: {
            selector: getSelector(target),
            tagName: 'SELECT',
            selectedIndex: select.selectedIndex,
            value: select.value,
            selectedText: select.options[select.selectedIndex]?.text || ''
          }
        });
      } else if (tagName === 'INPUT') {
        const input = /** @type {HTMLInputElement} */ (target);
        const inputType = input.type.toLowerCase();

        if (inputType === 'checkbox' || inputType === 'radio') {
          this.onEvent({
            type: EventType.INPUT,
            timestamp: Date.now(),
            data: {
              selector: getSelector(target),
              tagName: 'INPUT',
              inputType: inputType,
              checked: input.checked,
              value: input.value,
              name: input.name
            }
          });
        }
      }
    };

    // Focus/blur handlers
    this.handlers.focus = (e) => {
      const target = /** @type {Element} */ (e.target);
      if (!target || this.isExcluded(target)) return;

      const tagName = target.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'SELECT') return;

      this.onEvent({
        type: EventType.INPUT,
        timestamp: Date.now(),
        data: {
          selector: getSelector(target),
          tagName: tagName,
          action: 'focus'
        }
      });
    };

    this.handlers.blur = (e) => {
      const target = /** @type {Element} */ (e.target);
      if (!target || this.isExcluded(target)) return;

      const tagName = target.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'SELECT') return;

      this.onEvent({
        type: EventType.INPUT,
        timestamp: Date.now(),
        data: {
          selector: getSelector(target),
          tagName: tagName,
          action: 'blur'
        }
      });
    };

    // Add event listeners
    document.addEventListener('input', this.handlers.input, { capture: true });
    document.addEventListener('change', this.handlers.change, { capture: true });
    document.addEventListener('focus', this.handlers.focus, { capture: true });
    document.addEventListener('blur', this.handlers.blur, { capture: true });
  }

  /**
   * Stops recording input events
   */
  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    document.removeEventListener('input', this.handlers.input, { capture: true });
    document.removeEventListener('change', this.handlers.change, { capture: true });
    document.removeEventListener('focus', this.handlers.focus, { capture: true });
    document.removeEventListener('blur', this.handlers.blur, { capture: true });

    this.handlers = {};
  }
}
