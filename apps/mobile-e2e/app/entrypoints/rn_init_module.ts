import {springboard} from 'springboard';

import {mobileE2ERoutingDemoModule} from '../modules/routing_demo_module';

const initializeRNSpringboardEngine = springboard.entrypoint(async ({register}) => {
  await register(mobileE2ERoutingDemoModule);
});

export default initializeRNSpringboardEngine;
