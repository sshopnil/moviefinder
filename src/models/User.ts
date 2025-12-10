import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please provide a name"],
            maxlength: [60, "Name cannot be more than 60 characters"],
        },
        email: {
            type: String,
            required: [true, "Please provide an email"],
            unique: true,
            maxlength: [100, "Email cannot be more than 100 characters"],
        },
        password: {
            type: String,
            required: [true, "Please provide a password"],
        },
        image: {
            type: String,
        },
    },
    { timestamps: true }
);

// Prevent overwriting model if already compiled
export default mongoose.models.User || mongoose.model("User", UserSchema);
