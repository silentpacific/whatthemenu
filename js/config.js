// js/config.js - Secure configuration without hardcoded secrets

// Supabase Configuration - Use public anon key only
const SUPABASE_CONFIG = {
    // These should be your PUBLIC values - never include service keys in frontend code
    url: 'https://tibeuchezcksymjivgwr.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYmV1Y2hlemNrc3ltaml2Z3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTQyNDAsImV4cCI6MjA2NjU5MDI0MH0.hx8ocUMZQaAvo50L_KtI9FuH4lklAT5N1th-H4njVrw'
};

// API Configuration
const CONFIG = {
    // API Endpoints
    API_BASE_URL: '/.netlify/functions',

    ENDPOINTS: {
        SCAN_MENU: '/scan-menu',
        CREATE_PAYMENT: '/create-payment'
    },
    
    // Supabase config
    SUPABASE: SUPABASE_CONFIG,
    
    // File Upload Settings
    FILE_UPLOAD: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB in bytes
        ACCEPTED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        ACCEPTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp']
    },
    
    // Language Configuration
    SUPPORTED_LANGUAGES: {
        'en': 'English',
        'es': 'Spanish', 
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'ja': 'Japanese',
        'ko': 'Korean',
        'zh': 'Chinese',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'th': 'Thai',
        'vi': 'Vietnamese',
        'nl': 'Dutch',
        'sv': 'Swedish',
        'da': 'Danish',
        'no': 'Norwegian',
        'fi': 'Finnish',
        'pl': 'Polish',
        'cs': 'Czech',
        'hu': 'Hungarian',
        'ro': 'Romanian',
        'bg': 'Bulgarian',
        'hr': 'Croatian',
        'sk': 'Slovak',
        'sl': 'Slovenian',
        'et': 'Estonian',
        'lv': 'Latvian',
        'lt': 'Lithuanian',
        'el': 'Greek',
        'tr': 'Turkish',
        'he': 'Hebrew',
        'fa': 'Persian',
        'ur': 'Urdu',
        'bn': 'Bengali',
        'ta': 'Tamil',
        'te': 'Telugu',
        'ml': 'Malayalam',
        'kn': 'Kannada',
        'gu': 'Gujarati',
        'pa': 'Punjabi',
        'ne': 'Nepali',
        'si': 'Sinhala',
        'my': 'Burmese',
        'km': 'Khmer',
        'lo': 'Lao',
        'ka': 'Georgian',
        'hy': 'Armenian',
        'az': 'Azerbaijani',
        'kk': 'Kazakh',
        'ky': 'Kyrgyz',
        'uz': 'Uzbek',
        'mn': 'Mongolian'
    },
    
    // UI Settings
    UI: {
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 500,
        TOAST_DURATION: 5000,
        MODAL_ANIMATION_DURATION: 300
    },
    
    // Error Messages
    ERROR_MESSAGES: {
        FILE_TOO_LARGE: 'File size must be less than 10MB',
        INVALID_FILE_TYPE: 'Please upload a valid image file (JPG, PNG, WebP)',
        UPLOAD_FAILED: 'Failed to upload image. Please try again.',
        ANALYSIS_FAILED: 'Failed to analyze menu. Please try again.',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        RATE_LIMIT: 'You have reached your monthly scan limit. Please upgrade your plan.',
        GENERIC_ERROR: 'Something went wrong. Please try again.',
        NO_TEXT_FOUND: 'No text found in the image. Please try a clearer photo.',
        INVALID_LANGUAGE: 'Invalid target language selected.',
        PAYMENT_FAILED: 'Payment processing failed. Please try again.',
        SESSION_EXPIRED: 'Your session has expired. Please refresh the page.'
    },
    
    // Success Messages
    SUCCESS_MESSAGES: {
        SCAN_COMPLETE: 'Menu analysis complete!',
        PAYMENT_SUCCESS: 'Payment processed successfully!',
        SUBSCRIPTION_UPDATED: 'Subscription updated successfully!',
        IMAGE_UPLOADED: 'Image uploaded successfully!'
    },
    
    // Development Settings
    DEBUG: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    
    // Analytics (if needed)
    ANALYTICS: {
        ENABLED: true,
        TRACK_SCANS: true,
        TRACK_PAYMENTS: true,
        TRACK_ERRORS: true
    }
};

// Initialize Supabase client
let supabaseClient = null;
if (typeof window !== 'undefined' && window.supabase) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_CONFIG.url, 
        SUPABASE_CONFIG.anonKey
    );
}

// Utility functions
CONFIG.getApiUrl = function(endpoint) {
    return this.API_BASE_URL + this.ENDPOINTS[endpoint];
};

CONFIG.validateFile = function(file) {
    if (!file) {
        return { valid: false, error: this.ERROR_MESSAGES.GENERIC_ERROR };
    }
    
    if (file.size > this.FILE_UPLOAD.MAX_SIZE) {
        return { valid: false, error: this.ERROR_MESSAGES.FILE_TOO_LARGE };
    }
    
    if (!this.FILE_UPLOAD.ACCEPTED_TYPES.includes(file.type)) {
        return { valid: false, error: this.ERROR_MESSAGES.INVALID_FILE_TYPE };
    }
    
    return { valid: true };
};

CONFIG.getLanguageName = function(code) {
    return this.SUPPORTED_LANGUAGES[code] || code;
};

CONFIG.getSupabaseClient = function() {
    return supabaseClient;
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.supabaseClient = supabaseClient;
}

// Development logging
if (CONFIG.DEBUG) {
    console.log('🔧 Config loaded:', CONFIG);
}