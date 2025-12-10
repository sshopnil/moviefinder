
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
        },
    },
    { timestamps: true }
);

// Index for getting recent searches efficiently
SearchHistorySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.SearchHistory || mongoose.model("SearchHistory", SearchHistorySchema);
