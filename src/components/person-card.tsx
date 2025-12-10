
import { TMDB_IMAGE_URL } from "@/lib/tmdb";
import { User, UserMinus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PersonCardProps {
    person: {
        id: number;
        name: string;
        profile_path: string | null;
        known_for_department: string;
    };
}

export function PersonCard({ person }: PersonCardProps) {
    return (
        <Link href={`/person/${person.id}`} className="group block bg-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors">
            <div className="relative aspect-square rounded-full overflow-hidden mb-3 mx-auto max-w-[120px] bg-black/20 group-hover:ring-2 ring-blue-500/50 transition-all">
                {person.profile_path ? (
                    <Image
                        src={TMDB_IMAGE_URL.profile(person.profile_path)}
                        alt={person.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-xs">No Image</div>
                )}
            </div>
            <p className="text-center text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">{person.name}</p>
            <p className="text-center text-xs text-gray-400 truncate">{person.known_for_department}</p>
        </Link>
    );
}
