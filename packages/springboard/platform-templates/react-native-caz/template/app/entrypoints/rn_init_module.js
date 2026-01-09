<% if (injectCustomCode) { %>// This file will be replaced during scaffolding with dist/rn-main/neutral/dist/index.js
/**
 * Springboard entrypoint for React Native apps
 * This file will be copied from the built rn-main package during scaffolding
 */
export default function springboardEntrypoint(springboardRegistry) {
  console.log('Placeholder entrypoint - will be replaced by CLI with built rn-main module');
}<% } else { %>/**
 * Default Springboard entrypoint for React Native apps
 * Register your custom modules here
 * @param {import('springboard/engine/register').SpringboardRegistry} springboardRegistry 
 */
export default function springboardEntrypoint(springboardRegistry) {
  // Register your custom modules here
  // Example:
  // springboardRegistry.defineModule('MyCustomModule', () => import('./my_custom_module'));
  
  console.log('Springboard React Native app initialized');
}<% } %>