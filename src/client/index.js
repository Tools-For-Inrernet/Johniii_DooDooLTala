/**
 * Webvisor Client SDK - Entry Point
 * @module webvisor-client
 */

export { Webvisor } from './Webvisor.js';
export { DOMRecorder, getSelector, serializeNode } from './recorder/DOMRecorder.js';
export { InteractionRecorder, throttle } from './recorder/InteractionRecorder.js';
export { InputRecorder } from './recorder/InputRecorder.js';
export { NavigationRecorder } from './recorder/NavigationRecorder.js';
export { EventType, MutationType, DEFAULT_CONFIG } from '../shared/constants.js';

// Auto-initialize if data attribute is present
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const script = document.querySelector('script[data-webvisor-auto]');

    if (script) {
      const config = {};

      // Parse config from data attributes
      if (script.dataset.endpoint) {
        config.endpoint = script.dataset.endpoint;
      }
      if (script.dataset.samplingRate) {
        config.samplingRate = parseInt(script.dataset.samplingRate, 10);
      }
      if (script.dataset.maskAllInputs === 'true') {
        config.privacy = { maskAllInputs: true };
      }

      const { Webvisor } = await import('./Webvisor.js');
      const webvisor = new Webvisor(config);
      webvisor.start();

      // Expose to global scope
      window.__webvisor = webvisor;
    }
  });
}
