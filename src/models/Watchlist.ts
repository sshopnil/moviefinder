import mongoose from "mongoose";

const WatchlistSchema = new mongoose.Schema(
    {
        userId: {
            type: String, // Allow both ObjectId strings and OAuth UUIDs
            required: true,
            index: true
        },
        movieId: {
            type: Number,
            required: true,
        },
        // Cache basic details to avoid fetching from TMDB for simple lists
        title: String,
        poster_path: String,
        vote_average: Number,
        release_date: String,
        genre_ids: [Number],
        watched: {
            type: Boolean,
            default: false
        },
    },
    { timestamps: true }
);

// Compound index to ensure a user can only add a movie once
WatchlistSchema.index({ userId: 1, movieId: 1 }, { unique: true });

export default mongoose.models.Watchlist || mongoose.model("Watchlist", WatchlistSchema);
