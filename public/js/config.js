// Configuration loader for Firebase and API keys
// This file should be customized for your specific project

// For security in production, these values should come from your hosting provider's environment variables
// For local development, you can update these values directly or load from a config endpoint

const config = {
    // Firebase Configuration - Get these from Firebase Console > Project Settings
    firebase: {
        apiKey: "AIzaSyB7YGGpGOzRNgFxgNvT2YrK4Lx1YoMcT9w", // Replace with your actual Firebase API key
        authDomain: "bussiness-finder-8a04d.firebaseapp.com", // Replace with your project domain
        projectId: "bussiness-finder-8a04d", // Replace with your project ID
        storageBucket: "bussiness-finder-8a04d.appspot.com", // Replace with your storage bucket
        messagingSenderId: "895982258653", // Replace with your messaging sender ID
        appId: "1:895982258653:web:abcdef1234567890" // Replace with your actual app ID
    },
    
    // Google Maps API Key - Get this from Google Cloud Console
    googleMaps: {
        apiKey: "YOUR_GOOGLE_MAPS_API_KEY_HERE" // Replace with your Google Maps API key
    },
    
    // Application settings
    app: {
        name: "Business Finder",
        version: "1.0.0",
        environment: "development" // development, staging, production
    },
    
    // Development settings
    development: {
        useEmulators: true,
        emulators: {
            auth: "http://localhost:9099",
            firestore: "localhost:8080",
            functions: "http://localhost:5001"
        }
    }
};

// Function to get configuration values
function getConfig(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], config);
}

// Export configuration
window.appConfig = config;
window.getConfig = getConfig;

console.log('Configuration loaded for:', config.app.name);