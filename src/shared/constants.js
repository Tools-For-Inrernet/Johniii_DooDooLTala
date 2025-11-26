/**
 * Webvisor Event Types
 * @readonly
 * @enum {number}
 */
export const EventType = {
  // DOM Events
  DOM_SNAPSHOT: 0,
  DOM_MUTATION: 1,

  // Interaction Events
  MOUSE_MOVE: 2,
  MOUSE_CLICK: 3,
  SCROLL: 4,
  INPUT: 5,
  RESIZE: 6,

  // Navigation Events
  PAGE_LOAD: 7,
  PAGE_TRANSITION: 8,

  // Session Events
  SESSION_START: 9,
  SESSION_END: 10
};

/**
 * Mutation Types
 * @readonly
 * @enum {number}
 */
export const MutationType = {
  CHILD_LIST: 0,
  ATTRIBUTES: 1,
  CHARACTER_DATA: 2
};

/**
 * Sensitive field types that should be masked by default
 */
export const SENSITIVE_INPUT_TYPES = [
  'password',
  'email',
  'tel',
  'credit-card',
  'cc-number',
  'cc-exp',
  'cc-csc'
];

/**
 * Sensitive input name patterns (regex)
 */
export const SENSITIVE_NAME_PATTERNS = [
  /password/i,
  /passwd/i,
  /credit/i,
  /card/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /social.*security/i,
  /secret/i,
  /token/i
];

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  // Sampling: percentage of sessions to record (0-100)
  samplingRate: 100,

  // Retention period in days
  retentionDays: 15,

  // Privacy settings
  privacy: {
    maskAllInputs: false,
    maskSensitiveInputs: true,
    excludeAttribute: 'data-ym-disable',
    excludePages: []
  },

  // Event batching
  batchSize: 50,
  batchInterval: 1000, // ms

  // Mouse tracking throttle (ms)
  mouseThrottle: 50,

  // Scroll tracking throttle (ms)
  scrollThrottle: 100,

  // Server endpoint
  endpoint: '/api/webvisor/events'
};
