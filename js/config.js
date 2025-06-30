// js/config.js - Configuration settings and constants

// API Configuration
const CONFIG = {
    // API Endpoints
    API_BASE_URL: '/.netlify/functions',

    ENDPOINTS: {
        SCAN_MENU: '/scan-menu',
        CREATE_PAYMENT: '/create-payment'
    },
    
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
    
    // Subscription Tiers
    SUBSCRIPTION_TIERS: {
        FREE: {
            name: 'Casual Diner',
            monthly_limit: 3,
            features: ['Basic translations', '10+ languages', 'Mobile app access']
        },
        PREMIUM: {
            name: 'Food Explorer', 
            monthly_limit: -1, // Unlimited
            price: 9.99,
            features: ['Unlimited scans', 'Advanced AI', '50+ languages', 'Dietary info', 'Recommendations', 'Save favorites']
        },
        PRO: {
            name: 'Travel Pro',
            monthly_limit: -1, // Unlimited
            price: 99,
            yearly: true,
            features: ['Everything in Food Explorer', 'Offline mode', 'Priority support', 'Cuisine insights', 'Travel integration']
        }
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

// Utility function to get API URL
CONFIG.getApiUrl = function(endpoint) {
    return this.API_BASE_URL + this.ENDPOINTS[endpoint];
};

// Utility function to validate file
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

// Utility function to get language name
CONFIG.getLanguageName = function(code) {
    return this.SUPPORTED_LANGUAGES[code] || code;
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// Development logging
if (CONFIG.DEBUG) {
    console.log('🔧 Config loaded:', CONFIG);
}