import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

function shouldUseDirectConnection(uri: string) {
    if (!uri.startsWith("mongodb://")) {
        return false;
    }

    try {
        const url = new URL(uri);

        if (url.searchParams.has("directConnection") || url.searchParams.has("replicaSet")) {
            return false;
        }

        const seedList = uri
            .slice("mongodb://".length)
            .split("@").pop()
            ?.split("/")[0]
            .split("?")[0];

        return Boolean(seedList && !seedList.includes(","));
    } catch {
        return false;
    }
}

interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    var mongoose: MongooseCache;
}

let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
    if (!MONGODB_URI) {
        throw new Error(
            "Please define the MONGODB_URI environment variable."
        );
    }

    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
            ...(shouldUseDirectConnection(MONGODB_URI) ? { directConnection: true } : {}),
        };

        cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export default connectToDatabase;
