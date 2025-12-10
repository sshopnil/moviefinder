
"use client";

import { useMemo, useState } from "react";
import { PersonCard } from "./person-card";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PersonBrowserProps {
    people: any[];
    title?: string;
}

export function PersonBrowser({ people, title = "Results" }: PersonBrowserProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const totalPages = Math.ceil(people.length / itemsPerPage);

    const paginatedPeople = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return people.slice(startIndex, startIndex + itemsPerPage);
    }, [people, currentPage]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <div className="space-y-6">
            {title && (
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white pl-2 border-l-4 border-blue-500">{title}</h2>
                    <span className="text-gray-400 text-sm">Showing {paginatedPeople.length} of {people.length} results</span>
                </div>
            )}

            {paginatedPeople.length > 0 ? (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {paginatedPeople.map((person) => (
                            <PersonCard key={person.id} person={person} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-12">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </button>

                            <span className="text-gray-400">
                                Page <span className="text-white font-medium">{currentPage}</span> of {totalPages}
                            </span>

                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-6 w-6" />
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-20 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-lg">No people found matching your criteria.</p>
                </div>
            )}
        </div>
    );
}
