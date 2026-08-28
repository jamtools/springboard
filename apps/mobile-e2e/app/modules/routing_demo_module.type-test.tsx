import type {SpringboardNavigateOptions} from 'springboard/router';

import {routingDemoRoutes} from './routing_demo_module';

type RoutingDemoRoutes = typeof routingDemoRoutes;

const exactRegisteredRoutes: RoutingDemoRoutes = routingDemoRoutes;
void exactRegisteredRoutes;

const validDynamicNavigation: SpringboardNavigateOptions<'/songs/$songId'> = {
  to: '/songs/$songId',
  params: {songId: 'typed-song'},
  search: {tab: 'lyrics'},
};
void validDynamicNavigation;

// @ts-expect-error unknown paths must not be accepted by the app route registry.
const invalidPathNavigation: SpringboardNavigateOptions<'/not-registered'> = {
  to: '/not-registered',
};
void invalidPathNavigation;

// @ts-expect-error dynamic routes require their path params.
const missingRequiredParams: SpringboardNavigateOptions<'/songs/$songId'> = {
  to: '/songs/$songId',
  search: {tab: 'lyrics'},
};
void missingRequiredParams;

const invalidSearch: SpringboardNavigateOptions<'/songs/$songId'> = {
  to: '/songs/$songId',
  params: {songId: 'typed-song'},
  // @ts-expect-error validateSearch output narrows tab to the accepted literals.
  search: {tab: 'tabs'},
};
void invalidSearch;
