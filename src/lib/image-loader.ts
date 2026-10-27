import type { ImageLoader } from 'next/image';

/**
 * Custom loader for TMDB images to bypass server-side Next.js image resizing CPU load.
 * Maps the requested width to the closest available TMDB CDN size.
 */
const tmdbLoader: ImageLoader = ({ src, width, quality }) => {
    // Only handle TMDB images
    if (!src.includes('image.tmdb.org')) {
        return src;
    }

    const cleanSrc = src.split('?')[0];

    // Identify image type from either semantic path markers or TMDB size prefixes
    const isBackdrop = cleanSrc.includes('/backdrop/') || cleanSrc.includes('/w1280/') || cleanSrc.includes('/w780/') || cleanSrc.includes('/original/');
    const isProfile = cleanSrc.includes('/profile/') || cleanSrc.includes('/h632/');
    const isPoster = cleanSrc.includes('/poster/') || cleanSrc.includes('/w500/') || cleanSrc.includes('/w342/') || cleanSrc.includes('/w185/') || cleanSrc.includes('/w154/') || cleanSrc.includes('/w92/');

    // Extract the actual image filename
    const parts = cleanSrc.split('/');
    const path = parts[parts.length - 1];

    if (!path || path === 'poster' || path === 'backdrop' || path === 'profile') {
        return src;
    }

    let tmdbWidth = 'w500';

    if (isBackdrop) {
        if (width <= 300) tmdbWidth = 'w300';
        else if (width <= 780) tmdbWidth = 'w780';
        else if (quality && quality >= 90 && width > 1280) tmdbWidth = 'original';
        else tmdbWidth = 'w1280';
    } else if (isPoster) {
        if (width <= 92) tmdbWidth = 'w92';
        else if (width <= 154) tmdbWidth = 'w154';
        else if (width <= 185) tmdbWidth = 'w185';
        else if (width <= 342) tmdbWidth = 'w342';
        else if (width <= 500) tmdbWidth = 'w500';
        else tmdbWidth = 'w780';
    } else if (isProfile) {
        if (width <= 45) tmdbWidth = 'w45';
        else if (width <= 185) tmdbWidth = 'w185';
        else tmdbWidth = 'h632';
    } else {
        if (width <= 185) tmdbWidth = 'w185';
        else if (width <= 500) tmdbWidth = 'w500';
        else tmdbWidth = 'w780';
    }

    const widthParam = width ? `?w=${width}` : '';
    return `https://image.tmdb.org/t/p/${tmdbWidth}/${path}${widthParam}`;
};

export default tmdbLoader;
