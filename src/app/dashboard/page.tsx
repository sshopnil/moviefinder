import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { UserPasswordForm } from "@/components/user-password-form";
import { getRecentlyViewedAction } from "@/actions/history";
import { ContinueWatchingRow } from "@/components/continue-watching-row";
import { ProfileEditForm } from "@/components/profile-edit-form";
import { FeedbackForm } from "@/components/feedback-form";

export default async function DashboardPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login");
    }

    const history = await getRecentlyViewedAction(20);

    return (
        <main className="container mx-auto px-4 py-20 min-h-screen">
            <h1 className="text-4xl font-bold mb-8 text-white">Dashboard</h1>

            {/* Continue Watching Section */}
            {history.length > 0 && (
                <div className="mb-12">
                    <ContinueWatchingRow items={history} />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="space-y-6">
                    <h2 className="text-2xl font-semibold text-white mb-4">Edit Profile</h2>
                    <ProfileEditForm name={session.user.name || ""} email={session.user.email || ""} />
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
            </div>

            <div className="mt-8">
                <GlassCard className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-white mb-2">App Feedback</h2>
                        <p className="text-sm text-gray-400">Report bugs, request features, or send general feedback.</p>
                    </div>
                    <FeedbackForm />
                </GlassCard>
            </div>
        </main>
    );
}
