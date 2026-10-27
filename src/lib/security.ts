export function validateRequestOrigin(
    hostHeader: string | null,
    originHeader: string | null,
    refererHeader: string | null
): boolean {
    if (!hostHeader) return true;

    const primaryHost = hostHeader.split(",")[0]?.trim().toLowerCase().replace(/:(80|443)$/, "");

    if (originHeader) {
        try {
            const originHost = new URL(originHeader).host.toLowerCase().replace(/:(80|443)$/, "");
            if (originHost !== primaryHost) {
                return false;
            }
        } catch {
            return false;
        }
    }

    if (refererHeader) {
        try {
            const refererHost = new URL(refererHeader).host.toLowerCase().replace(/:(80|443)$/, "");
            if (refererHost !== primaryHost) {
                return false;
            }
        } catch {
            return false;
        }
    }

    return true;
}
