import {Note} from 'tonal';

import {UltimateGuitarSetlist, UltimateGuitarSetlistSong, UltimateGuitarSetlistStatus, UltimateGuitarTab} from './ultimate_guitar_types';

export type ParsedTabPageData = {
    title: string;
    tabData: string;
}

export const parseUltimateGuitarHTMLContent = (doc: Document): ParsedTabPageData | null => {
    let title = '';
    const titleContainer = doc.querySelector('meta[property="og:title"]');
    if (titleContainer) {
        title = (titleContainer as HTMLMetaElement).content;
        title = title.replace(' (Chords)', '');
        title = title.replace(' (Official)', '');
        title = title.replace(' (Bass)', '');
    }

    const el = doc.querySelector('.js-store');
    const content = el?.getAttribute('data-content');

    // const newDom = new JSDOM();
    const houseForEscapedHTML = doc.createElement('div');

    houseForEscapedHTML.innerHTML = content || '';
    const unescapedJSONData = houseForEscapedHTML.textContent || '';

    let tabData: string | undefined;
    try {
        const jsonData = JSON.parse(unescapedJSONData);
        tabData = jsonData?.store?.page.data.tab_view.wiki_tab.content;
    } catch (e) {
        console.error(e);
    }

    if (!tabData) {
        throw new Error('failed to parse chord sheet data');
        // return null;
    }

    return {
        title,
        tabData,
    };
};

type GetTabFromCurrentSetlistDataReturnValue = {
    setlist?: UltimateGuitarSetlist;
    tab?: UltimateGuitarTab;
    song?: UltimateGuitarSetlistSong;
}

export const getTabFromCurrentSetlistData = (setlistStatus: UltimateGuitarSetlistStatus | null, savedSetlists: UltimateGuitarSetlist[], savedTabs: UltimateGuitarTab[]): GetTabFromCurrentSetlistDataReturnValue => {
    if (!setlistStatus || setlistStatus.songIndex === -1) {
        return {
            setlist: undefined,
            tab: undefined,
            song: undefined,
        };
    }

    const setlist = savedSetlists.find(s => s.id === setlistStatus.setlistId);
    if (!setlist) {
        return {
            setlist: undefined,
            tab: undefined,
            song: undefined,
        };
    }

    const currentSong = setlist.songs[setlistStatus.songIndex];
    const tab = savedTabs.find(t => t.url === currentSong.url);
    return {
        setlist,
        tab: tab,
        song: currentSong,
    };
};

export const prepareLyricsWithChords = (tabLyrics: string, options: {showChords: boolean, transpose: number}): string => {
    return tabLyrics
        .replace(/\[ch.*?\](.*?)\[\/ch\]/g, (match, captureAny) => {
            if (!options.showChords) {
                return '';
            }

            if (!options.transpose || !transposeIntervals[options.transpose]) {
                return captureAny;
            }

            const capture = captureAny as string;

            let suffix = '';
            let mainPart = capture;
            if (!isNaN(parseInt(capture[capture.length - 1]))) {
                suffix = capture[capture.length - 1];
                mainPart = capture.substring(0, capture.length - 1);
            }

            const interval = transposeIntervals[(options.transpose + 12) % 12];
            const transposed = Note.transpose(mainPart, interval);

            return transposed + suffix;
        })
        .replace(/\[\/?tab\]/g, '')
        .replace(/\[\/?syllable.*?\]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{2,}/g, '\n\n');
};

const transposeIntervals: Record<number, string> = {
    1: '2m',
    2: '2M',
    3: '3m',
    4: '3M',
    5: '4P',
    7: '5P',
    8: '6m',
    9: '6M',
    10: '7m',
    11: '7M',
};
