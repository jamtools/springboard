import springboard from 'springboard';
import '@/app/modules/counter_module';

// Register the node maestro module
springboard.registerModule('NodeMaestroInit', {}, async (moduleAPI) => {
  console.log('[NodeMaestroInit] Initializing node maestro platform');

  // Node-specific initialization
  console.log('[NodeMaestroInit] Running on Node.js:', process.version);

  return {};
});
