import type {DocumentMeta} from 'springboard/module_registry/module_registry';

/**
 * Injects document metadata into an HTML string.
 * Replaces the <title> tag and adds/updates meta tags in the <head> section.
 */
export function injectDocumentMeta(html: string, meta: DocumentMeta): string {
    let modifiedHtml = html;

    if (meta.title) {
        const titleRegex = /<title>.*?<\/title>/i;
        const escapedTitle = escapeHtml(meta.title);
        if (titleRegex.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(titleRegex, `<title>${escapedTitle}</title>`);
        } else {
            modifiedHtml = modifiedHtml.replace(/<head>/i, `<head>\n    <title>${escapedTitle}</title>`);
        }
    }

    const metaTags: string[] = [];

    if (meta.description) {
        metaTags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
    }
    if (meta.keywords) {
        metaTags.push(`<meta name="keywords" content="${escapeHtml(meta.keywords)}">`);
    }
    if (meta.author) {
        metaTags.push(`<meta name="author" content="${escapeHtml(meta.author)}">`);
    }
    if (meta.robots) {
        metaTags.push(`<meta name="robots" content="${escapeHtml(meta.robots)}">`);
    }

    if (meta['Content-Security-Policy']) {
        metaTags.push(`<meta http-equiv="Content-Security-Policy" content="${escapeHtml(meta['Content-Security-Policy'])}">`);
    }

    if (meta['og:title']) {
        metaTags.push(`<meta property="og:title" content="${escapeHtml(meta['og:title'])}">`);
    }
    if (meta['og:description']) {
        metaTags.push(`<meta property="og:description" content="${escapeHtml(meta['og:description'])}">`);
    }
    if (meta['og:image']) {
        metaTags.push(`<meta property="og:image" content="${escapeHtml(meta['og:image'])}">`);
    }
    if (meta['og:url']) {
        metaTags.push(`<meta property="og:url" content="${escapeHtml(meta['og:url'])}">`);
    }

    const knownKeys = new Set([
        'title',
        'description',
        'Content-Security-Policy',
        'keywords',
        'author',
        'robots',
        'og:title',
        'og:description',
        'og:image',
        'og:url',
    ]);

    for (const [key, value] of Object.entries(meta)) {
        if (!knownKeys.has(key) && typeof value === 'string') {
            if (key.startsWith('og:')) {
                metaTags.push(`<meta property="${escapeHtml(key)}" content="${escapeHtml(value)}">`);
            } else {
                metaTags.push(`<meta name="${escapeHtml(key)}" content="${escapeHtml(value)}">`);
            }
        }
    }

    if (metaTags.length > 0) {
        const metaTagsString = '\n    ' + metaTags.join('\n    ');
        modifiedHtml = modifiedHtml.replace(/<\/head>/i, `${metaTagsString}\n  </head>`);
    }

    return modifiedHtml;
}

function escapeHtml(text: string): string {
    const htmlEscapeMap: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '\'': '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}
