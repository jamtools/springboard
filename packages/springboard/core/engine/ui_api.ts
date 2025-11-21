import React from 'react';
import {Module, RegisteredRoute} from 'springboard/module_registry/module_registry';
import {ModuleDependencies} from '../types/module_types';
import {RegisterRouteOptions} from './register';

/**
 * UI API - Methods for registering UI components and routes.
 *
 * **Scope:** Client-side only (not available on server builds without UI).
 *
 * **React Router:** Routes are registered with React Router for client-side navigation.
 */
export class UIAPI {
    constructor(
        private module: Module,
        private modDeps: ModuleDependencies
    ) {}

    /**
     * Register a route with the application's React Router.
     *
     * **Path Matching:**
     * - Empty string `''` or `'/'` matches the module's root path
     * - Relative paths are scoped to the module (e.g., `'/settings'` → `'/modules/MyModule/settings'`)
     *
     * @example
     * ```typescript
     * // Matches "/modules/MyModule" and "/modules/MyModule/"
     * moduleAPI.ui.registerRoute('/', {}, () => {
     *   return <div>Home</div>;
     * });
     *
     * // Matches "/modules/MyModule/settings"
     * moduleAPI.ui.registerRoute('/settings', {}, () => {
     *   return <div>Settings</div>;
     * });
     *
     * // Hide application shell (full-screen route)
     * moduleAPI.ui.registerRoute('/fullscreen', {hideApplicationShell: true}, () => {
     *   return <div>Fullscreen Content</div>;
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/ui-routes | UI Routes Guide}
     */
    registerRoute = (
        routePath: string,
        options: RegisterRouteOptions,
        component: RegisteredRoute['component']
    ): void => {
        const routes = this.module.routes || {};
        routes[routePath] = {
            options,
            component,
        };

        this.module.routes = {...routes};
        if (this.modDeps.moduleRegistry.getCustomModule(this.module.moduleId)) {
            this.modDeps.moduleRegistry.refreshModules();
        }
    };

    /**
     * Register an application shell component that wraps all routes.
     *
     * **Purpose:** Provide consistent layout, navigation, and styling around all module routes.
     *
     * **Props:** Receives `{modules: Module[], children: React.ReactNode}`
     *
     * @example
     * ```typescript
     * moduleAPI.ui.registerApplicationShell(({modules, children}) => {
     *   return (
     *     <div>
     *       <header>
     *         <nav>
     *           {modules.map(m => (
     *             <Link key={m.moduleId} to={`/modules/${m.moduleId}`}>
     *               {m.moduleId}
     *             </Link>
     *           ))}
     *         </nav>
     *       </header>
     *       <main>{children}</main>
     *       <footer>© 2025</footer>
     *     </div>
     *   );
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/application-shell | Application Shell Guide}
     */
    registerApplicationShell = (
        component: React.ElementType<React.PropsWithChildren<{modules: Module[]}>>
    ): void => {
        this.module.applicationShell = component;
    };

    /**
     * Register a React context provider that wraps the entire application.
     *
     * **Purpose:** Provide global context (theme, auth, etc.) to all components.
     *
     * **Future:** This method is planned but not yet implemented.
     *
     * @example
     * ```typescript
     * moduleAPI.ui.registerReactProvider(({children}) => {
     *   return (
     *     <ThemeProvider theme={theme}>
     *       <AuthProvider>
     *         {children}
     *       </AuthProvider>
     *     </ThemeProvider>
     *   );
     * });
     * ```
     *
     * @see {@link https://docs.springboard.dev/react-providers | React Providers Guide}
     */
    registerReactProvider = (
        _provider: React.ComponentType<{children: React.ReactNode}>
    ): void => {
        // TODO: Implement provider registration
        throw new Error('registerReactProvider is not yet implemented');
    };
}
