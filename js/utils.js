// js/utils.js - Utility functions

const Utils = {
    
    // File handling utilities
    file: {
        /**
         * Convert file to base64 string
         * @param {File} file - The file to convert
         * @returns {Promise<string>} Base64 string
         */
        toBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
        },

        /**
         * Validate file before upload
         * @param {File} file - The file to validate
         * @returns {Object} Validation result
         */
        validate(file) {
            return CONFIG.validateFile(file);
        },

        /**
         * Format file size for display
         * @param {number} bytes - File size in bytes
         * @returns {string} Formatted size string
         */
        formatSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
    },

    // DOM manipulation utilities
    dom: {
        /**
         * Safely get element by ID
         * @param {string} id - Element ID
         * @returns {HTMLElement|null} Element or null
         */
        get(id) {
            return document.getElementById(id);
        },

        /**
         * Show element with animation
         * @param {HTMLElement} element - Element to show
         * @param {string} display - Display type (default: 'block')
         */
        show(element, display = 'block') {
            if (!element) return;
            element.style.display = display;
            element.style.opacity = '0';
            element.style.transform = 'translateY(10px)';
            
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${CONFIG.UI.ANIMATION_DURATION}ms ease, transform ${CONFIG.UI.ANIMATION_DURATION}ms ease`;
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            });
        },

        /**
         * Hide element with animation
         * @param {HTMLElement} element - Element to hide
         */
        hide(element) {
            if (!element) return;
            element.style.transition = `opacity ${CONFIG.UI.ANIMATION_DURATION}ms ease, transform ${CONFIG.UI.ANIMATION_DURATION}ms ease`;
            element.style.opacity = '0';
            element.style.transform = 'translateY(-10px)';
            
            setTimeout(() => {
                element.style.display = 'none';
            }, CONFIG.UI.ANIMATION_DURATION);
        },

        /**
         * Add loading state to element
         * @param {HTMLElement} element - Element to add loading to
         * @param {string} text - Loading text
         */
        setLoading(element, text = 'Loading...') {
            if (!element) return;
            element.classList.add('loading');
            element.disabled = true;
            element.dataset.originalText = element.textContent;
            element.textContent = text;
        },

        /**
         * Remove loading state from element
         * @param {HTMLElement} element - Element to remove loading from
         */
        removeLoading(element) {
            if (!element) return;
            element.classList.remove('loading');
            element.disabled = false;
            if (element.dataset.originalText) {
                element.textContent = element.dataset.originalText;
                delete element.dataset.originalText;
            }
        }
    },

    // API utilities
    api: {
        /**
         * Make API request with error handling
         * @param {string} url - API endpoint URL
         * @param {Object} options - Fetch options
         * @returns {Promise<Object>} API response
         */
        async request(url, options = {}) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    ...options
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || CONFIG.ERROR_MESSAGES.GENERIC_ERROR);
                }

                return { success: true, data };
            } catch (error) {
                console.error('API Request failed:', error);
                return { 
                    success: false, 
                    error: error.message || CONFIG.ERROR_MESSAGES.NETWORK_ERROR 
                };
            }
        },

        /**
         * Upload image and analyze menu
         * @param {File} file - Image file
         * @param {string} targetLanguage - Target language code
         * @returns {Promise<Object>} Analysis result
         */
        async scanMenu(file, targetLanguage) {
            try {
                const base64 = await Utils.file.toBase64(file);
                
                const response = await this.request(CONFIG.getApiUrl('SCAN_MENU'), {
                    method: 'POST',
                    body: JSON.stringify({
                        image: base64,
                        targetLanguage: targetLanguage,
                        timestamp: Date.now()
                    })
                });

                return response;
            } catch (error) {
                console.error('Menu scan failed:', error);
                return {
                    success: false,
                    error: error.message || CONFIG.ERROR_MESSAGES.ANALYSIS_FAILED
                };
            }
        }
    },

    // UI feedback utilities
    feedback: {
        /**
         * Show toast notification
         * @param {string} message - Message to show
         * @param {string} type - Toast type (success, error, info)
         */
        showToast(message, type = 'info') {
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            
            // Style the toast
            Object.assign(toast.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                padding: '1rem 1.5rem',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '600',
                zIndex: '10001',
                opacity: '0',
                transform: 'translateX(100%)',
                transition: 'all 0.3s ease'
            });

            // Set background color based on type
            const colors = {
                success: '#10b981',
                error: '#ef4444', 
                info: '#0891b2',
                warning: '#f59e0b'
            };
            toast.style.backgroundColor = colors[type] || colors.info;

            // Add to DOM and animate in
            document.body.appendChild(toast);
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            });

            // Remove after duration
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, CONFIG.UI.TOAST_DURATION);
        },

        /**
         * Show error message
         * @param {string} message - Error message
         */
        showError(message) {
            this.showToast(message, 'error');
        },

        /**
         * Show success message
         * @param {string} message - Success message
         */
        showSuccess(message) {
            this.showToast(message, 'success');
        }
    },

    // String utilities
    string: {
        /**
         * Truncate string to specified length
         * @param {string} str - String to truncate
         * @param {number} length - Maximum length
         * @returns {string} Truncated string
         */
        truncate(str, length = 100) {
            if (!str || str.length <= length) return str;
            return str.substring(0, length) + '...';
        },

        /**
         * Capitalize first letter of string
         * @param {string} str - String to capitalize
         * @returns {string} Capitalized string
         */
        capitalize(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        /**
         * Convert string to kebab-case
         * @param {string} str - String to convert
         * @returns {string} Kebab-case string
         */
        kebabCase(str) {
            return str.replace(/\s+/g, '-').toLowerCase();
        }
    },

    // Date utilities
    date: {
        /**
         * Format date for display
         * @param {Date|string} date - Date to format
         * @returns {string} Formatted date string
         */
        format(date) {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        },

        /**
         * Get relative time string
         * @param {Date|string} date - Date to compare
         * @returns {string} Relative time string
         */
        timeAgo(date) {
            const now = new Date();
            const past = new Date(date);
            const diffMs = now - past;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return this.format(date);
        }
    },

    // Local storage utilities
    storage: {
        /**
         * Save data to localStorage
         * @param {string} key - Storage key
         * @param {any} value - Value to store
         */
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.warn('Failed to save to localStorage:', error);
            }
        },

        /**
         * Get data from localStorage
         * @param {string} key - Storage key
         * @param {any} defaultValue - Default value if key not found
         * @returns {any} Stored value or default
         */
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.warn('Failed to read from localStorage:', error);
                return defaultValue;
            }
        },

        /**
         * Remove data from localStorage
         * @param {string} key - Storage key
         */
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.warn('Failed to remove from localStorage:', error);
            }
        }
    },

    // Analytics utilities
    analytics: {
        /**
         * Track event
         * @param {string} event - Event name
         * @param {Object} data - Event data
         */
        track(event, data = {}) {
            if (!CONFIG.ANALYTICS.ENABLED) return;
            
            if (CONFIG.DEBUG) {
                console.log('📊 Analytics event:', event, data);
            }
            
            // Add your analytics tracking code here
            // Example: gtag('event', event, data);
        },

        /**
         * Track menu scan
         * @param {string} language - Target language
         * @param {boolean} success - Whether scan was successful
         */
        trackScan(language, success) {
            if (!CONFIG.ANALYTICS.TRACK_SCANS) return;
            
            this.track('menu_scan', {
                target_language: language,
                success: success,
                timestamp: Date.now()
            });
        },

        /**
         * Track error
         * @param {string} error - Error message
         * @param {string} context - Error context
         */
        trackError(error, context = 'unknown') {
            if (!CONFIG.ANALYTICS.TRACK_ERRORS) return;
            
            this.track('error', {
                error_message: error,
                error_context: context,
                timestamp: Date.now()
            });
        }
    }
};

// Export for use in other files
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}

// Development logging
if (CONFIG.DEBUG) {
    console.log('🛠️ Utils loaded:', Object.keys(Utils));
}