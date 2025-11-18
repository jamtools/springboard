---
title: "Module Development"
description: "Reference pages are ideal for outlining how things work in terse and clear terms."
summary: ""
date: 2023-09-07T16:13:18+02:00
lastmod: 2023-09-07T16:13:18+02:00
draft: false
weight: 10
toc: true
seo:
  title: "" # custom title (optional)
  description: "" # custom description (recommended)
  canonical: "" # custom canonical URL (optional)
  robots: "" # custom robot tags (optional)
---

A Springboard application is typically comprised of several modules. A given module uses the [ModuleAPI](../typedoc_docs/module_api/classes/ModuleAPI.md) to register components, actions, and states with the application. When a module is initialized, it's given its own copy of the `ModuleAPI`. Any actions or states created will be scoped to the given module's state namespace behind the scenes.

The ModuleAPI allows modules to:

- Create remote actions and shared states
- Register routes and render React components
- Receive dependencies through dependency injection
- Expose functions and utilties for other modules to use. This typically includes actions, states, or stateful React components.
- Interact with other modules by consuming their exposed functions/properties
- When the same module is defined on two devices, any actions defined can be called between devices.

Modules can play a few different types of roles:

- Feature - A feature-level module implements certain features for your application. These modules typically register routes and interact with other modules to faciliate cohesion and "get stuff done".
- Utility - A utility module exposes things for other modules to use, and likely does not register any routes. An example utility module is the [Macro Module](/docs/jamtools/midi-macros), which exposes functions for other modules to declare MIDI entrypoints for a given feature.
- Initializer - An initializer module does some initial setup for an application. This kind of module is typically not needed for small applications, though these modules become useful when deployment use cases are complicated. You may want to have some specific initialization on a mobile app versus desktop app, for instance.

---

## Writing a feature module

When registering a module, the module provides a callback to run on app initialization. The callback the module provides essentially _is_ the module. The callback receives an instance of the `ModuleAPI`. The namespacing of states and actions for this particular module are automatically managed by the framework. Some useful methods/properties from the `ModuleAPI` are documented in the [ModuleAPI docs](../typedoc_docs/module_api/classes/ModuleAPI.md).

Check out the [Tic-Tac-Toe example](https://github.com/jamtools/springboard/blob/main/apps/small_apps/tic_tac_toe/tic_tac_toe.tsx) and [Song Structure example](https://github.com/jamtools/springboard/blob/main/packages/jamtools/features/modules/song_structures_dashboards/song_structures_dashboards_module.tsx) for examples of feature modules.

## Writing a utility module

By default it is assumed a module is a feature or initializer module, meaning it is assumed that the module does not expose anything for other modules to use. In order for other modules to be aware of any exposed functions/properties, we need to perform [interface merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces) to register the module's return value with the Springboard framework's module system.

Here's an [example](
https://github.com/jamtools/springboard/blob/cea35258c6d7e495a68148c4a9e61ac06dcca609/packages/jamtools/core/modules/macro_module/macro_module.tsx#L31-L35) of the Macro module declaring its return type:


```ts
declare module 'springboard/module_registry/module_registry' {
    interface AllModules {
        macro: MacroModule;
    }
}
```

This makes it so any other module that interacts with this module knows what is available from that module, and typescript can provide the relevant autocompletions and type checking for consuming this module. When the module is registered with the framework, the type checker will ensure that the return value matches what is defined in the `AllModules` interface.
