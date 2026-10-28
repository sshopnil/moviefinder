import mongoose from "mongoose";

const OMDbCacheSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        ratings: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        cooldownUntil: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// Automatically expire cached items after 7 days
OMDbCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export default mongoose.models.OMDbCache || mongoose.model("OMDbCache", OMDbCacheSchema);
