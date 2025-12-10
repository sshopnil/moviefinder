import { movieService } from "@/lib/tmdb";
import { MediaGallery } from "./media-gallery";

interface MediaGalleryLoaderProps {
    id: number;
}

export async function MediaGalleryLoader({ id }: MediaGalleryLoaderProps) {
    // Artificial delay to demonstrate suspense (optional, but good for testing smoothness)
    // await new Promise(resolve => setTimeout(resolve, 1000));

    const images = await movieService.getMovieImages(id);

    return <MediaGallery images={images} />;
}
