/**
 * DOM Recorder - Captures DOM mutations using MutationObserver API
 * @module DOMRecorder
 */

import { EventType, MutationType } from '../../shared/constants.js';

/**
 * Generates a unique CSS selector for an element
 * @param {Element} element
 * @returns {string}
 */
function getSelector(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      parts.unshift(selector);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0]) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = parent;

    if (parts.length > 5) break;
  }

  return parts.join(' > ');
}

/**
 * Serializes a DOM node for reconstruction
 * @param {Node} node
 * @param {Set<Element>} excludedElements
 * @returns {object|null}
 */
function serializeNode(node, excludedElements = new Set()) {
  if (!node) return null;

  if (node.nodeType === Node.ELEMENT_NODE && excludedElements.has(node)) {
    return null;
  }

  const serialized = {
    type: node.nodeType,
    name: node.nodeName
  };

  if (node.nodeType === Node.TEXT_NODE) {
    serialized.text = node.textContent;
  } else if (node.nodeType === Node.COMMENT_NODE) {
    serialized.text = node.textContent;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = /** @type {Element} */ (node);

    // Serialize attributes
    if (element.attributes.length > 0) {
      serialized.attrs = {};
      for (const attr of element.attributes) {
        serialized.attrs[attr.name] = attr.value;
      }
    }

    // Serialize children
    if (element.childNodes.length > 0) {
      serialized.children = [];
      for (const child of element.childNodes) {
        const childSerialized = serializeNode(child, excludedElements);
        if (childSerialized) {
          serialized.children.push(childSerialized);
        }
      }
    }

    // Special handling for certain elements
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      serialized.value = element.value || '';
    }
    if (element.tagName === 'SELECT') {
      serialized.selectedIndex = element.selectedIndex;
    }
  }

  return serialized;
}

/**
 * DOMRecorder class - Records DOM mutations
 */
export class DOMRecorder {
  /**
   * @param {object} options
   * @param {Function} options.onEvent - Callback for recorded events
   * @param {string} options.excludeAttribute - Attribute to mark excluded elements
   */
  constructor(options = {}) {
    this.onEvent = options.onEvent || (() => {});
    this.excludeAttribute = options.excludeAttribute || 'data-ym-disable';
    this.observer = null;
    this.nodeIdMap = new WeakMap();
    this.nextNodeId = 1;
  }

  /**
   * Gets or assigns a unique ID for a node
   * @param {Node} node
   * @returns {number}
   */
  getNodeId(node) {
    if (!this.nodeIdMap.has(node)) {
      this.nodeIdMap.set(node, this.nextNodeId++);
    }
    return this.nodeIdMap.get(node);
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

    // Check if element or any ancestor has exclude attribute
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
   * Captures initial DOM snapshot
   * @returns {object}
   */
  captureSnapshot() {
    const excludedElements = new Set();

    // Find all excluded elements
    document.querySelectorAll(`[${this.excludeAttribute}]`).forEach(el => {
      excludedElements.add(el);
      el.querySelectorAll('*').forEach(child => excludedElements.add(child));
    });

    const snapshot = {
      type: EventType.DOM_SNAPSHOT,
      timestamp: Date.now(),
      data: {
        doctype: document.doctype ? {
          name: document.doctype.name,
          publicId: document.doctype.publicId,
          systemId: document.doctype.systemId
        } : null,
        html: serializeNode(document.documentElement, excludedElements),
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        scroll: {
          x: window.pageXOffset,
          y: window.pageYOffset
        }
      }
    };

    this.onEvent(snapshot);
    return snapshot;
  }

  /**
   * Starts recording DOM mutations
   */
  start() {
    if (this.observer) {
      return;
    }

    this.observer = new MutationObserver(mutations => {
      this.processMutations(mutations);
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true,
      attributeOldValue: true,
      characterDataOldValue: true
    });
  }

  /**
   * Processes mutation records
   * @param {MutationRecord[]} mutations
   */
  processMutations(mutations) {
    const events = [];

    for (const mutation of mutations) {
      // Skip mutations in excluded elements
      if (mutation.target.nodeType === Node.ELEMENT_NODE &&
          this.isExcluded(/** @type {Element} */ (mutation.target))) {
        continue;
      }

      const event = {
        type: EventType.DOM_MUTATION,
        timestamp: Date.now(),
        data: {
          targetId: this.getNodeId(mutation.target),
          targetSelector: getSelector(mutation.target)
        }
      };

      switch (mutation.type) {
        case 'childList':
          event.data.mutationType = MutationType.CHILD_LIST;
          event.data.addedNodes = Array.from(mutation.addedNodes)
            .filter(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return !this.isExcluded(/** @type {Element} */ (node));
              }
              return true;
            })
            .map(node => ({
              id: this.getNodeId(node),
              node: serializeNode(node)
            }));
          event.data.removedNodes = Array.from(mutation.removedNodes)
            .map(node => this.getNodeId(node));
          break;

        case 'attributes':
          event.data.mutationType = MutationType.ATTRIBUTES;
          event.data.attributeName = mutation.attributeName;
          event.data.oldValue = mutation.oldValue;
          event.data.newValue = mutation.target.getAttribute(mutation.attributeName);
          break;

        case 'characterData':
          event.data.mutationType = MutationType.CHARACTER_DATA;
          event.data.oldValue = mutation.oldValue;
          event.data.newValue = mutation.target.textContent;
          break;
      }

      events.push(event);
    }

    if (events.length > 0) {
      events.forEach(event => this.onEvent(event));
    }
  }

  /**
   * Stops recording DOM mutations
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

export { getSelector, serializeNode };
