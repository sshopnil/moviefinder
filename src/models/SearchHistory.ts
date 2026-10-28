
import mongoose from "mongoose";

const SearchHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },
        query: {
            type: String,
            required: true,
            maxlength: 200,
        },
    },
    { timestamps: true }
);

// Index for getting recent searches efficiently and auto-expiring after 90 days
SearchHistorySchema.index({ userId: 1, updatedAt: -1 });
SearchHistorySchema.index({ userId: 1, query: 1 }, { unique: true });
SearchHistorySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.models.SearchHistory || mongoose.model("SearchHistory", SearchHistorySchema);
