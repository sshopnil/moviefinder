export function validateRequestOrigin(
    hostHeader: string | null,
    originHeader: string | null,
    refererHeader: string | null,
    requireOrigin: boolean = false
): boolean {
    if (!hostHeader) return !requireOrigin;
    if (!originHeader && !refererHeader) return !requireOrigin;

    const primaryHost = hostHeader.split(",")[0]?.trim().toLowerCase().replace(/:(80|443)$/, "");
    if (!primaryHost) return !requireOrigin;

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

