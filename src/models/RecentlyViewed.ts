
import mongoose from "mongoose";

const RecentlyViewedSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },
        itemId: {
            type: Number,
            required: true,
        },
        itemType: {
            type: String,
            enum: ['movie', 'person'],
            required: true,
        },
        title: String,
        poster_path: String,
    },
    { timestamps: true }
);

// Compound index to ensure unique item per user (update timestamp on revisit)
RecentlyViewedSchema.index({ userId: 1, itemId: 1, itemType: 1 }, { unique: true });
RecentlyViewedSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.models.RecentlyViewed || mongoose.model("RecentlyViewed", RecentlyViewedSchema);
