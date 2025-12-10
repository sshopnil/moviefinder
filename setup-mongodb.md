# How to Setup MongoDB Atlas for MovieFinder

1.  **Create an Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and sign up/sign in.
2.  **Create a Cluster**:
    *   Click **+ Create**.
    *   Select **M0 Sandbox** (Free Tier).
    *   Choose a provider (AWS) and region near you.
    *   Click **Create Cluster**.
3.  **Setup Database User** (Critical for "bad auth" errors):
    *   Go to **Database Access** (in the left sidebar).
    *   Click **+ Add New Database User**.
    *   **Authentication Method**: Password.
    *   **Username**: `admin` (or whatever you prefer).
    *   **Password**: Create a secure password. **Write this down!**
    *   Click **Add User**.
4.  **Setup Network Access**:
    *   Go to **Network Access** (in the left sidebar).
    *   Click **+ Add IP Address**.
    *   Click **Allow Access from Anywhere** (`0.0.0.0/0`) for development.
    *   Click **Confirm**.
5.  **Get Connection String**:
    *   Go back to **Database** (left sidebar).
    *   Click **Connect** on your cluster.
    *   Select **Drivers**.
    *   You will see a string like: `mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
6.  **Update `.env.local`**:
    *   Copy that string string.
    *   Replace `<username>` with your username (e.g., `admin`).
    *   Replace `<password>` with your password.
    *   **IMPORTANT**: If your password has special characters (like `@`, `:`, etc.), please URL Encode them (e.g., `@` -> `%40`).
    *   Paste it into your `.env.local` file:
        ```env
        MONGODB_URI="mongodb+srv://admin:mypassword123@cluster0.abcde.mongodb.net/moviefinder?retryWrites=true&w=majority"
        ```
    *   (Optional) Add `/moviefinder` after `.net` to specify the database name like in the example above.
