import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { UserPasswordForm } from "@/components/user-password-form";
import { History, User } from "lucide-react";
import { getRecentlyViewedAction } from "@/actions/history";
import { MovieCard } from "@/components/movie-card";
import { PersonCard } from "@/components/person-card";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <main className="container mx-auto px-4 py-20 min-h-screen">
            <h1 className="text-4xl font-bold mb-8 text-white">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white mb-4">Profile</h2>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400">Name</label>
                        <div className="text-lg text-white">{session.user.name}</div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400">Email</label>
                        <div className="text-lg text-white">{session.user.email}</div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400">Account Type</label>
                        <div className="text-lg text-white capitalize">
                            {/* We can infer this, but for now just showing simple info */}
                            User
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white mb-4">Security</h2>
                    <UserPasswordForm userEmail={session.user.email!} />
                </GlassCard>

                <GlassCard className="space-y-6 md:col-span-2">
                    <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                        <History className="h-6 w-6 text-gray-400" />
                        Recently Viewed
                    </h2>
                    <DashboardHistory />
                </GlassCard>
            </div>
        </main>
    );
}

async function DashboardHistory() {
    const history = await getRecentlyViewedAction(10);

    if (history.length === 0) {
        return <p className="text-gray-400">No recently viewed items.</p>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {history.map((item: any) => {
                if (item.media_type === 'person') {
                    return <PersonCard key={`person-${item.id}`} person={{ ...item, known_for_department: 'Actor' }} />;
                }
                return (
                    <MovieCard
                        key={`movie-${item.id}`}
                        movie={{
                            ...item,
                            vote_average: 0,
                            release_date: '',
                            genre_ids: []
                        }}
                    />
                );
            })}
        </div>
    );
}
