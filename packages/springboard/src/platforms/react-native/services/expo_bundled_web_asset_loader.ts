import {Asset} from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export type BundledWebAssetModules = {
    html: unknown;
    css: unknown;
    js: unknown;
};

export type LoadBundledWebAppAssetsOptions = {
    assetModules: BundledWebAssetModules;
    destinationDirectory?: string | null;
    htmlFileName?: string;
    cssFileName?: string;
    jsFileName?: string;
    replaceCssHref?: RegExp;
    replaceJsSrc?: RegExp;
    transformHtml?: (html: string, paths: {htmlFilePath: string; cssFilePath: string; jsFilePath: string}) => string;
};

const DEFAULT_CSS_PATTERN = /<link rel="stylesheet" href="\/dist\/index-([A-Za-z0-9]+)\.css">/;
const DEFAULT_JS_PATTERN = /<script src="\/dist\/index-([A-Za-z0-9]+)\.js"><\/script>/;

export const loadBundledWebAppAssets = async (options: LoadBundledWebAppAssetsOptions) => {
    const destinationDirectory = options.destinationDirectory || (FileSystem as {documentDirectory?: string | null}).documentDirectory;
    if (!destinationDirectory) {
        throw new Error('No document directory available for Expo bundled web assets');
    }

    const htmlAsset = Asset.fromModule(options.assetModules.html as Parameters<typeof Asset.fromModule>[0]);
    const cssAsset = Asset.fromModule(options.assetModules.css as Parameters<typeof Asset.fromModule>[0]);
    const jsAsset = Asset.fromModule(options.assetModules.js as Parameters<typeof Asset.fromModule>[0]);

    await Promise.all([
        htmlAsset.downloadAsync(),
        cssAsset.downloadAsync(),
        jsAsset.downloadAsync(),
    ]);

    const htmlSourcePath = htmlAsset.localUri || '';
    const cssSourcePath = cssAsset.localUri || '';
    const jsSourcePath = jsAsset.localUri || '';

    const htmlFilePath = `${destinationDirectory}${options.htmlFileName || 'index.html'}`;
    const cssFilePath = `${destinationDirectory}${options.cssFileName || 'index.css'}`;
    const jsFilePath = `${destinationDirectory}${options.jsFileName || 'index.js'}`;

    const htmlContent = await FileSystem.readAsStringAsync(htmlSourcePath);

    await FileSystem.copyAsync({from: cssSourcePath, to: cssFilePath});
    await FileSystem.copyAsync({from: jsSourcePath, to: jsFilePath});

    const htmlWithCss = htmlContent.replace(
        options.replaceCssHref || DEFAULT_CSS_PATTERN,
        () => `<link rel="stylesheet" href="${cssFilePath}">`,
    );
    const htmlWithCssAndJs = htmlWithCss.replace(
        options.replaceJsSrc || DEFAULT_JS_PATTERN,
        () => `<script src="${jsFilePath}"></script>`,
    );

    const finalHtml = options.transformHtml
        ? options.transformHtml(htmlWithCssAndJs, {htmlFilePath, cssFilePath, jsFilePath})
        : htmlWithCssAndJs;

    await FileSystem.writeAsStringAsync(htmlFilePath, finalHtml);

    return {
        htmlFilePath,
        cssFilePath,
        jsFilePath,
        htmlContent: finalHtml,
    };
};
