# Study Aide - Setup Guide

This document provides instructions for setting up the Study Aide application correctly.

## Environment Variables

The application uses OpenAI's API for generating practice exams. To ensure proper functionality, you need to configure the environment variables correctly.

1. Create a `.env` file in the root directory of the project (if it doesn't exist already).
2. Add your OpenAI API key in the following format:

```
OPENAI_API_KEY="your-api-key-here"
VITE_OPENAI_API_KEY="your-api-key-here"
```

Notes:
- The `OPENAI_API_KEY` is used by server-side code
- The `VITE_OPENAI_API_KEY` is used by client-side code (though client-side API calls are not recommended for production)

## Running the Application

### Easy Installation (Windows)

1. Run the provided installation script:
```
install.bat
```

2. Start the development server:
```bash
npm run dev
```

### Manual Installation

If you're having trouble with dependencies:

1. Clear npm cache:
```bash
npm cache clean --force
```

2. Remove existing packages:
```bash
rm -rf node_modules package-lock.json .svelte-kit
```

3. Install dependencies:
```bash
npm install --no-package-lock
```

4. Prepare SvelteKit:
```bash
npm run prepare
```

5. Start the development server:
```bash
npm run dev
```

## Troubleshooting Common Issues

### API Errors

If you're seeing errors when generating practice exams:

1. Check that your OpenAI API key is valid and has sufficient credits.
2. Verify that both environment variables are correctly set.
3. Check the browser console and server logs for specific error messages.

### SvelteKit Version Issues

This application uses SvelteKit v1.x with Svelte 4.x. If you're having compatibility issues:

1. Make sure you're not mixing different versions of Svelte/SvelteKit components.
2. Try clearing the `.svelte-kit` cache folder if you've recently updated versions.

### Dependency Errors

If you see "ERESOLVE could not resolve" errors when installing:

1. Try the installation script or manual installation steps above.
2. If problems persist, check your Node.js version (v16 or newer recommended).
3. If using npm v7+, try `npm install --legacy-peer-deps`.

### Other Issues

If you encounter other problems:

1. Try deleting the `node_modules` directory and reinstalling dependencies.
2. Check that your Node.js version is compatible (v16 or newer recommended).
3. Clear your browser cache if you're seeing outdated content.