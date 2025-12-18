import { ImageLoader } from 'next/image';

/**
 * Custom loader for TMDB images to bypass Vercel Image Optimization limits.
 * This loader maps the requested width to the closest available TMDB width.
 */
const tmdbLoader: ImageLoader = ({ src, width, quality }) => {
    // Only handle TMDB images
    if (!src.includes('image.tmdb.org')) {
        return src;
    }

    // Identify image type from the placeholder path we'll use in TMDB_IMAGE_URL
    const isBackdrop = src.includes('/backdrop/');
    const isPoster = src.includes('/poster/');
    const isProfile = src.includes('/profile/');

    // Extract the actual image path (the part after /poster/, /backdrop/, etc.)
    const parts = src.split('/');
    const path = parts[parts.length - 1];

    if (!path || path === 'poster' || path === 'backdrop' || path === 'profile') {
        return src;
    }

    let tmdbWidth = 'original';

    if (isBackdrop) {
        if (width <= 300) tmdbWidth = 'w300';
        else if (width <= 780) tmdbWidth = 'w780';
        else if (width <= 1280) tmdbWidth = 'w1280';
        else tmdbWidth = 'original';
    } else if (isPoster) {
        if (width <= 92) tmdbWidth = 'w92';
        else if (width <= 154) tmdbWidth = 'w154';
        else if (width <= 185) tmdbWidth = 'w185';
        else if (width <= 342) tmdbWidth = 'w342';
        else if (width <= 500) tmdbWidth = 'w500';
        else if (width <= 780) tmdbWidth = 'w780';
        else tmdbWidth = 'original';
    } else if (isProfile) {
        if (width <= 45) tmdbWidth = 'w45';
        else if (width <= 185) tmdbWidth = 'w185';
        else tmdbWidth = 'h632';
    } else {
        if (width <= 500) tmdbWidth = 'w500';
        else tmdbWidth = 'original';
    }

    return `https://image.tmdb.org/t/p/${tmdbWidth}/${path}`;
};

export default tmdbLoader;
