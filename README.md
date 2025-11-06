# CV to PowerPoint Automator (Vite Version)

This is a modern frontend application built with Vite, React, TypeScript, and Tailwind CSS to automate the creation of PowerPoint presentations from LinkedIn CVs.

## Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or newer recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

## Local Development

1.  **Create an Environment File**

    Create a file named `.env.local` in the root of the project and add your Gemini API key:

    ```
    VITE_API_KEY=YOUR_GEMINI_API_KEY_HERE
    ```

2.  **Install Dependencies**

    Open your terminal in the project root and run:
    ```bash
    npm install
    ```

3.  **Run the Development Server**

    Start the Vite development server:
    ```bash
    npm run dev
    ```

    The application will now be running at `http://localhost:5173`.

## Available Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Compiles and bundles the application for production into the `dist` directory.
- `npm run preview`: Serves the production build locally to preview it.
