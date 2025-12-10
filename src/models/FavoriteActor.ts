
import mongoose from "mongoose";

const FavoriteActorSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },
        actorId: {
            type: Number,
            required: true,
        },
        name: String,
        profile_path: String,
        known_for_department: String,
    },
    { timestamps: true }
);

// Compound index to ensure unique favorites per user
FavoriteActorSchema.index({ userId: 1, actorId: 1 }, { unique: true });

export default mongoose.models.FavoriteActor || mongoose.model("FavoriteActor", FavoriteActorSchema);
