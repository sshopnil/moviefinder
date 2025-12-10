
import { movieService } from "@/lib/tmdb";
import { PersonBrowser } from "@/components/person-browser";
import { BackButton } from "@/components/back-button";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = {
    searchParams: Promise<{ q: string }>;
};

export default async function SearchPeoplePage({ searchParams }: Props) {
    const { q } = await searchParams;

    if (!q) return notFound();

    const people = await movieService.searchPeople(q);

    return (
        <div className="min-h-screen relative pb-20">
            <div className="container mx-auto px-4 py-8">
                <BackButton label="Back to Results" />

                <h1 className="text-3xl font-bold text-white mb-8">
                    People results for "{q}"
                </h1>

                <PersonBrowser people={people} />
            </div>
        </div>
    );
}
