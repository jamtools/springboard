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
     * **Ordering:**
     * Providers are stacked by rank (highest rank = outermost wrapper):
     * - Rank 100: "top" - Outermost providers (error boundaries, global state)
     * - Rank 0: "default" - Normal providers (most use cases)
     * - Rank -100: "bottom" - Innermost providers (theme, i18n)
     *
     * Within the same rank, providers are stacked in registration order
     * across all modules (first registered = outer wrapper).
     *
     * @example
     * ```typescript
     * // Default rank (0) - stacks in registration order
     * moduleAPI.ui.registerReactProvider(({children}) => (
     *   <ThemeProvider theme={theme}>
     *     {children}
     *   </ThemeProvider>
     * ));
     *
     * // Bottom rank - always innermost (close to app components)
     * moduleAPI.ui.registerReactProvider(({children}) => (
     *   <I18nProvider>
     *     {children}
     *   </I18nProvider>
     * ), { rank: 'bottom' });
     *
     * // Top rank - always outermost (wraps everything)
     * moduleAPI.ui.registerReactProvider(({children}) => (
     *   <ErrorBoundary>
     *     {children}
     *   </ErrorBoundary>
     * ), { rank: 'top' });
     *
     * // Custom numeric rank for fine control
     * moduleAPI.ui.registerReactProvider(MyProvider, { rank: 50 });
     * ```
     *
     * **Final order:** ErrorBoundary > ThemeProvider > I18nProvider > App
     *
     * @param provider - React component that accepts children
     * @param options - Optional configuration
     * @param options.rank - Stacking priority (higher = outer). Can be number or 'top' (100) / 'bottom' (-100)
     *
     * @see {@link https://docs.springboard.dev/react-providers | React Providers Guide}
     */
    registerReactProvider = (
        provider: React.ComponentType<{children: React.ReactNode}>,
        options?: {rank?: number | 'top' | 'bottom'}
    ): void => {
        if (!this.module.providers) {
            this.module.providers = [];
        }

        // Resolve rank from named constants or use default
        let rank = 0; // Default rank
        if (options?.rank !== undefined) {
            if (options.rank === 'top') {
                rank = 100;
            } else if (options.rank === 'bottom') {
                rank = -100;
            } else {
                rank = options.rank;
            }
        }

        this.module.providers.push({
            provider: provider as React.ElementType,
            rank,
        });
    };
}
