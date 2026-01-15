import mongoose from "mongoose";

const AICacheSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        modelUsed: {
            type: String,
        },
    },
    { timestamps: true }
);

// Add TTL index to expire after 30 days (optional, can be adjusted)
AICacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Prevent overwriting model if already compiled
export default mongoose.models.AICache || mongoose.model("AICache", AICacheSchema);
