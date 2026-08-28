import {Asset} from 'expo-asset';
import {File, Paths} from 'expo-file-system';

type ExpoAsset = {
    localUri?: string | null;
    downloadAsync(): Promise<void>;
};

type MetroAssetMetadata = {
    __packager_asset?: boolean;
    hash?: string;
    fileHashes?: string[];
    name: string;
    type: string;
    width?: number | null;
    height?: number | null;
    scales: number[];
    httpServerLocation?: string;
};

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
    const destinationDirectory = normalizeDirectoryUri(options.destinationDirectory || getDocumentDirectoryUri());
    if (!destinationDirectory) {
        throw new Error('No document directory available for Expo bundled web assets');
    }

    const htmlAsset = createAsset(options.assetModules.html);
    const cssAsset = createAsset(options.assetModules.css);
    const jsAsset = createAsset(options.assetModules.js);

    await Promise.all([
        htmlAsset.downloadAsync(),
        cssAsset.downloadAsync(),
        jsAsset.downloadAsync(),
    ]);

    const htmlSourcePath = requireAssetLocalUri(htmlAsset.localUri, 'html');
    const cssSourcePath = requireAssetLocalUri(cssAsset.localUri, 'css');
    const jsSourcePath = requireAssetLocalUri(jsAsset.localUri, 'js');

    const htmlFilePath = `${destinationDirectory}${options.htmlFileName || 'index.html'}`;
    const cssFilePath = `${destinationDirectory}${options.cssFileName || 'index.css'}`;
    const jsFilePath = `${destinationDirectory}${options.jsFileName || 'index.js'}`;

    const htmlContent = await new File(htmlSourcePath).text();

    await Promise.all([
        new File(cssSourcePath).copy(new File(cssFilePath), {overwrite: true}),
        new File(jsSourcePath).copy(new File(jsFilePath), {overwrite: true}),
    ]);

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

    new File(htmlFilePath).write(finalHtml);

    return {
        htmlFilePath,
        cssFilePath,
        jsFilePath,
        htmlContent: finalHtml,
    };
};

const getDocumentDirectoryUri = () => {
    try {
        return (Paths as {document?: {uri?: string | null}}).document?.uri || null;
    } catch {
        return null;
    }
};

const normalizeDirectoryUri = (uri: string | null | undefined) => {
    if (!uri) return null;

    return uri.replace(/\/*$/, '/');
};

const createAsset = (assetModule: unknown): ExpoAsset => {
    const resolvedAssetModule = unwrapDefaultAssetModule(assetModule);
    const metroAssetMetadata = normalizeMetroAssetMetadata(resolvedAssetModule);

    if (metroAssetMetadata) {
        return Asset.fromMetadata(metroAssetMetadata);
    }

    return Asset.fromModule(resolvedAssetModule);
};

const normalizeMetroAssetMetadata = (value: unknown): (MetroAssetMetadata & {hash: string}) | null => {
    if (!isMetroAssetMetadata(value)) {
        return null;
    }

    const hash = typeof value.hash === 'string' ? value.hash : value.fileHashes?.[0];
    if (!hash) {
        return null;
    }

    return {
        ...value,
        hash,
    };
};

const isMetroAssetMetadata = (value: unknown): value is MetroAssetMetadata => {
    return (
        typeof value === 'object'
        && value !== null
        && (
            typeof (value as {hash?: unknown}).hash === 'string'
            || isNonEmptyStringArray((value as {fileHashes?: unknown}).fileHashes)
        )
        && typeof (value as {name?: unknown}).name === 'string'
        && typeof (value as {type?: unknown}).type === 'string'
        && Array.isArray((value as {scales?: unknown}).scales)
    );
};

const isNonEmptyStringArray = (value: unknown): value is string[] => {
    return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
};

const unwrapDefaultAssetModule = (assetModule: unknown): unknown => {
    if (
        typeof assetModule === 'object'
        && assetModule !== null
        && 'default' in assetModule
        && !isMetroAssetMetadata(assetModule)
    ) {
        return (assetModule as {default: unknown}).default;
    }

    return assetModule;
};

const requireAssetLocalUri = (uri: string | null | undefined, assetName: string) => {
    if (!uri) {
        throw new Error(`No local URI available for Expo bundled web ${assetName} asset`);
    }

    return uri;
};
