// Configuration - UPDATE THESE VALUES
const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'YOUR_SUPABASE_URL_HERE',
    SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY_HERE',
    
    // Apps Script URL (for Sheet View sync) - Optional
    APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE'
};

// Validate configuration
function validateConfig() {
    if (CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || 
        CONFIG.SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
        console.error('❌ Supabase configuration is not set!');
        console.error('Please update config.js with your Supabase credentials');
        return false;
    }
    return true;
}

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, validateConfig };
}
