"use client";

import NextImage, { ImageProps } from 'next/image';
import tmdbLoader from '@/lib/image-loader';

/**
 * A wrapper around Next.js Image component that automatically applies 
 * the TMDB loader for tmdb images to avoid Vercel transformation costs.
 */
export default function Image(props: ImageProps) {
    const { src, loader, ...rest } = props;

    // Use custom loader if it's a TMDB image and no loader is explicitly provided
    const isTMDB = typeof src === 'string' && src.includes('image.tmdb.org');
    const finalLoader = loader || (isTMDB ? tmdbLoader : undefined);

    return (
        <NextImage
            src={src}
            loader={finalLoader}
            {...rest}
        />
    );
}
