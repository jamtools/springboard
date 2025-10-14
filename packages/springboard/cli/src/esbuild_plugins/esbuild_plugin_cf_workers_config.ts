import fs from 'fs';
import path from 'path';

import type {Plugin} from 'esbuild';

export const esbuildPluginCfWorkersConfig = (outDir: string, name: string): Plugin => {
    return {
        name: 'generate-cf-workers-config',
        setup(build) {
            build.onEnd(async result => {
                const outputFiles = Object.keys(result.metafile!.outputs).filter(f => !f.endsWith('.map'));

                const jsFileName = outputFiles.find(f => f.endsWith('.js'))?.split('/').pop();
                if (!jsFileName) {
                    throw new Error('esbuild plugin error "generate-cf-workers-config": Failed to find js file');
                }

                // Get deployment URL from environment variable
                const siteUrl = process.env.PUBLIC_SITE_URL || 'https://example.com';

                // Generate wrangler.toml content
                const wranglerTomlContent = `name = "${name || 'cf-workers-app'}"
main = "./neutral/dist/${jsFileName}"
compatibility_date = "2025-02-26"
compatibility_flags = ["nodejs_compat", "nodejs_compat_populate_process_env"]

# Deployment URL configuration
# Set via PUBLIC_SITE_URL environment variable during build
# Current value: ${siteUrl}

[[durable_objects.bindings]]
name = "MyServer"
class_name = "MyServer"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["MyServer"]

[build]
command = ""

[assets]
directory = "./browser"
binding = "ASSETS"

[vars]
PUBLIC_SITE_URL = "${siteUrl}"
`;

                const fullDestFilePath = path.resolve(`${outDir}/../../wrangler.toml`);
                await fs.promises.writeFile(fullDestFilePath, wranglerTomlContent);
            });
        }
    };
}
