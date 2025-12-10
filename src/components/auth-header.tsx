
import { auth } from "@/auth";
import { SiteHeader } from "./site-header";

export async function AuthHeader() {
    const session = await auth();

    return <SiteHeader user={session?.user} />;
}
