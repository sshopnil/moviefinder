
import { movieService, TMDB_IMAGE_URL } from "@/lib/tmdb";
import { MovieBrowser } from "@/components/movie-browser";
import { BackButton } from "@/components/back-button";
import { MapPin, Calendar, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
    params: Promise<{ id: string }>;
};

export default async function PersonPage({ params }: Props) {
    const { id } = await params;
    if (!id) return notFound();

    try {
        const [person, credits] = await Promise.all([
            movieService.getPersonDetails(parseInt(id)),
            movieService.getPersonCredits(parseInt(id))
        ]);

        return (
            <div className="min-h-screen relative pb-20">
                <div className="container mx-auto px-4 py-8">
                    <BackButton label="Back" />

                    <div className="grid md:grid-cols-[300px_1fr] gap-8 mb-16">
                        {/* Profile Image */}
                        <div className="relative aspect-[2/3] w-full max-w-[300px] rounded-xl overflow-hidden shadow-2xl mx-auto md:mx-0 bg-white/5">
                            {person.profile_path ? (
                                <Image
                                    src={TMDB_IMAGE_URL.profile(person.profile_path).replace("w185", "h632")} // Use larger image
                                    alt={person.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">No Image</div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="space-y-6">
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{person.name}</h1>

                                <div className="flex flex-wrap gap-4 text-sm text-gray-300 mb-6">
                                    {person.birthday && (
                                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full">
                                            <Calendar className="h-4 w-4" />
                                            <span>{person.birthday}</span>
                                        </div>
                                    )}
                                    {person.place_of_birth && (
                                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full">
                                            <MapPin className="h-4 w-4" />
                                            <span>{person.place_of_birth}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full">
                                        <Star className="h-4 w-4 text-yellow-500" />
                                        <span>{person.known_for_department}</span>
                                    </div>
                                </div>

                                <h3 className="text-lg font-semibold text-white mb-2">Biography</h3>
                                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/20">
                                    {person.biography || "No biography available."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <MovieBrowser movies={credits} title="Known For" description="Browsing all movies" />
                    </div>
                </div>
            </div>
        );

    } catch (e) {
        console.error(e);
        return notFound();
    }
}
