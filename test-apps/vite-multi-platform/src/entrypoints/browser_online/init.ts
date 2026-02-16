import springboard from 'springboard';
import '@/app/modules/counter_module';

// Register the main browser online module
springboard.registerModule('BrowserOnlineInit', {}, async (moduleAPI) => {
  console.log('[BrowserOnlineInit] Initializing browser online platform');

  return {};
});
