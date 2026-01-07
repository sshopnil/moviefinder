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

// Prevent overwriting model if already compiled
export default mongoose.models.AICache || mongoose.model("AICache", AICacheSchema);
