# MovieFinder

MovieFinder is a modern, feature-rich web application designed to help users discover movies, get AI-powered recommendations based on their mood, and track their watchlist. Built with the latest web technologies, it offers a seamless and visually stunning experience.

![MovieFinder](/public/logo.jpg)

## Features

-   **🎬 Movie Discovery**: Browse trending, top-rated, and categorized movies (e.g., Hollywood Hits, Korean Cinema, Japanese Gems).
-   **🔍 Advanced Search**: Search for movies and people with real-time results and filtering (release year, genre, rating, language).
-   **🧠 AI Mood Recommendations**: Describe your mood (e.g., "I want something inspiring and heartwarming") and get personalized movie suggestions powered by AI.
-   **👤 User Accounts**: Sign up and log in to manage your profile.
-   **❤️ Watchlist**: Save movies to your personal watchlist to keep track of what you want to see.
-   **👁️ Watched Status**: Mark movies as watched and organize your viewing history.
-   **📱 Responsive Design**: Fully optimized for desktop, tablet, and mobile devices with a sleek, dark-themed UI.

## Tech Stack

-   **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
-   **Database**: [MongoDB](https://www.mongodb.com/) with Mongoose
-   **Authentication**: [NextAuth.js](https://next-auth.js.org/)
-   **API Integration**: [TMDB API](https://www.themoviedb.org/documentation/api) for movie data
-   **AI**: Google Generative AI / OpenAI for mood-based recommendations
-   **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   MongoDB instance (local or Atlas)
-   TMDB API Key

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/sshopnil/moviefinder.git
    cd moviefinder
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Environment Setup**:
    Create a `.env` file in the root directory and add your environment variables:
    ```env
    MONGODB_URI=your_mongodb_connection_string
    NEXTAUTH_SECRET=your_auth_secret
    TMDB_API_KEY=your_tmdb_api_key
    GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
    # Add other necessary keys
    ```

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).
