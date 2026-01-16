// ========================================
// API CONFIGURATION HELPER
// ========================================
// Provides centralized API URL configuration for frontend requests
// Uses environment detection to determine appropriate API base URL

(function() {
    'use strict';
    
    let apiBaseUrl = null;
    
    // ========================================
// UTILITY FUNCTIONS
    // ========================================
    // Gets API base URL based on current environment
    function getApiBaseUrl() {
        if (apiBaseUrl) {
            return apiBaseUrl;
        }
        
        // Determines base URL from current location
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            apiBaseUrl = 'http://localhost:3001';
        } else {
            // Uses same origin for other environments
            apiBaseUrl = window.location.origin;
        }
        
        return apiBaseUrl;
    }
    
    // Builds full API URL from endpoint
    function getApiUrl(endpoint) {
        const base = getApiBaseUrl();
        // Removes leading slash from endpoint if present
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        // Removes 'api/' prefix if present to avoid double prefixing
        const finalEndpoint = cleanEndpoint.startsWith('api/') ? cleanEndpoint : `api/${cleanEndpoint}`;
        return `${base}/${finalEndpoint}`;
    }
    
    // ========================================
// GLOBAL EXPORTS
    // ========================================
    // Makes functions available globally for browser usage
    window.getApiBaseUrl = getApiBaseUrl;
    window.getApiUrl = getApiUrl;
    
    // Creates shorthand API object
    window.api = {
        baseUrl: getApiBaseUrl,
        url: getApiUrl
    };
})();
