// Public declaration-merge surface for application and plugin registration types.
//
// Applications should augment this module instead of internal Springboard paths:
//
// declare module 'springboard/register' {
//   interface RegisteredModules {
//     MyModule: typeof myModule;
//   }
// }

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RegisteredModules {}
