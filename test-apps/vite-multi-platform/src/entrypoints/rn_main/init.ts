import springboard from 'springboard';
import '@/app/modules/counter_module';

// Register the RN main module
// This bundle runs in the React Native runtime, not in a webview
springboard.registerModule('RNMainInit', {}, async (moduleAPI) => {
  console.log('[RNMainInit] Initializing React Native main platform');
  console.log('[RNMainInit] Running in React Native runtime');

  // Note: No DOM rendering here - this is the RN host bundle
  // It exports modules that the RN app can use

  return {};
});

// Export for RN to consume
export { springboard };

// Start springboard
springboard.start().catch(console.error);
