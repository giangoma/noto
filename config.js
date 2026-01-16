// ========================================
// UTILITY FUNCTIONS
// ========================================
// Gets API base URL based on environment and configuration
const getApiBaseUrl = () => {
    // Checks if running in browser environment
    if (typeof window !== 'undefined') {
        // Uses meta tag configuration if available
        const metaApiUrl = document.querySelector('meta[name="api-base-url"]')?.getAttribute('content');
        if (metaApiUrl) {
            return metaApiUrl;
        }
        
        // Checks for environment-specific configuration
        // Uses script tag or build process for configuration
        if (window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
        
        // Defaults to current origin for same-origin requests
        // Uses relative URLs when frontend and backend are on the same domain
        const hostname = window.location.hostname;
        
        // Uses localhost:3001 for local environment
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001';
        }
        
        // Uses same origin for different environments
        // Set API_BASE_URL environment variable for different subdomain
        return window.location.origin;
    }
    
    // Server-side fallback
    return process.env.API_BASE_URL || 'http://localhost:3001';
};

// ========================================
// EXPORTS
// ========================================
// Makes API base URL available globally for browser usage
if (typeof window !== 'undefined') {
    window.API_BASE_URL = getApiBaseUrl();
}

// Builds full API URL from endpoint
const getApiUrl = (endpoint) => {
    const baseUrl = getApiBaseUrl();
    // Removes leading slash from endpoint if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${baseUrl}/${cleanEndpoint}`;
};

// Makes getApiUrl function available globally
if (typeof window !== 'undefined') {
    window.getApiUrl = getApiUrl;
}
