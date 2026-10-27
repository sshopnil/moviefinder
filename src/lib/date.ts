export function formatHistoryDate(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
        });
    } catch {
        return "";
    }
}
