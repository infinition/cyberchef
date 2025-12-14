# Cyber Chef

Cyber chef is a cyberpunk-themed recipe management application. This application features a glassmorphism UI, advanced media management, and local persistence for all your recipes.

infinition.github.io/cyberchef/

## Features

*   **Cyberpunk Aesthetics:** Immersive interface with neon accents, glassmorphism effects, and custom typography.
*   **Recipe Management:** Create, edit, and organize your recipes with ease.
*   **Rich Text Editor:** detailed instructions with support for Markdown, headings, and lists.
*   **Advanced Media Handling:**
    *   Upload and manage images and videos for each recipe.
    *   Drag-and-drop media directly into recipe instructions.
    *   Interactive gallery view.
*   **Smart Search & Filtering:** Quickly find recipes by title, tags, or ingredients.
*   **Dynamic Servings:** Automatically adjust ingredient quantities based on the desired number of servings.
*   **Local Persistence:** All data is stored locally on your machine, ensuring you own your data.
*   **Import/Export:** Support for backing up and sharing your recipe database.

## Tech Stack

*   **Frontend:** HTML5, Vanilla CSS3, Vanilla JavaScript.
*   **Backend:** Node.js, Express.
*   **Libraries:**
    *   [Marked](https://marked.js.org/) (Markdown parsing)
    *   [Font Awesome](https://fontawesome.com/) (Icons)
    *   [JSZip](https://stuk.github.io/jszip/) & [Pako](https://nodeca.github.io/pako/) (Compression/Export)
    *   [Multer](https://github.com/expressjs/multer) (File uploads)

## Installation

1.  **Clone the repository** (or download the source code).
2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Usage

1.  **Start the local server**:
    ```bash
    npm start
    ```
    The server will start on port 3000.

2.  **Access the application**:
    Open your web browser and navigate to:
    [http://localhost:3000](http://localhost:3000)

## Project Structure

*   `server.js`: The Express server handling API requests and file operations.
*   `index.html`: The main entry point for the frontend application.
*   `recipes/`: Directory where `recipes.json` and media files are stored.
    *   `recipes.json`: The database file containing all recipe data.
    *   `medias/`: Folder containing uploaded images and videos.

## License

This project is for personal use.
