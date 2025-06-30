// js/main.js - Main application logic

class MenuScanner {
    constructor() {
        this.currentFile = null;
        this.isProcessing = false;
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.bindEvents();
        this.setupHeader();
        this.populateLanguageSelect();
        
        if (CONFIG.DEBUG) {
            console.log('🚀 MenuScanner initialized');
        }
    }

    /**
     * Bind all event listeners
     */
    bindEvents() {
        // File upload events
        const fileInput = Utils.dom.get('file-input');
        const uploadArea = Utils.dom.get('upload-area');
        const scanBtn = Utils.dom.get('scan-btn');
        const closeModal = Utils.dom.get('close-modal');
        const modal = Utils.dom.get('result-modal');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }

        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.handleScan());
        }

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });

        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => this.handleSmoothScroll(e));
        });
    }

    /**
     * Setup header scroll effects
     */
    setupHeader() {
        const header = document.querySelector('.header');
        if (!header) return;

        let lastScrollY = window.scrollY;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            
            if (currentScrollY > 100) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            lastScrollY = currentScrollY;
        });
    }

    /**
     * Populate language select dropdown
     */
    populateLanguageSelect() {
        const languageSelect = Utils.dom.get('target-language');
        if (!languageSelect) return;

        // Clear existing options
        languageSelect.innerHTML = '';

        // Add popular languages first
        const popularLanguages = ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh'];
        
        popularLanguages.forEach(code => {
            if (CONFIG.SUPPORTED_LANGUAGES[code]) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = CONFIG.SUPPORTED_LANGUAGES[code];
                languageSelect.appendChild(option);
            }
        });

        // Add separator
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '───────────';
        languageSelect.appendChild(separator);

        // Add remaining languages
        Object.entries(CONFIG.SUPPORTED_LANGUAGES).forEach(([code, name]) => {
            if (!popularLanguages.includes(code)) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = name;
                languageSelect.appendChild(option);
            }
        });
    }

    /**
     * Handle file selection
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        this.processFile(file);
    }

    /**
     * Handle drag over
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        const uploadArea = Utils.dom.get('upload-area');
        uploadArea?.classList.add('dragover');
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        const uploadArea = Utils.dom.get('upload-area');
        uploadArea?.classList.remove('dragover');
    }

    /**
     * Handle file drop
     */
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const uploadArea = Utils.dom.get('upload-area');
        uploadArea?.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Process uploaded file
     */
    processFile(file) {
        if (!file) return;

        // Validate file
        const validation = Utils.file.validate(file);
        if (!validation.valid) {
            Utils.feedback.showError(validation.error);
            return;
        }

        this.currentFile = file;
        this.updateUploadUI(file);
        this.enableScanButton();

        Utils.feedback.showSuccess(CONFIG.SUCCESS_MESSAGES.IMAGE_UPLOADED);
    }

    /**
     * Update upload UI with file info
     */
    updateUploadUI(file) {
        const uploadArea = Utils.dom.get('upload-area');
        if (!uploadArea) return;

        const uploadContent = uploadArea.querySelector('.upload-content');
        if (!uploadContent) return;

        uploadContent.innerHTML = `
            <div class="upload-icon">📎</div>
            <div class="upload-text">
                <p class="upload-primary">${file.name}</p>
                <p class="upload-secondary">${Utils.file.formatSize(file.size)} • Click to change</p>
            </div>
        `;
    }

    /**
     * Enable scan button
     */
    enableScanButton() {
        const scanBtn = Utils.dom.get('scan-btn');
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.classList.remove('disabled');
        }
    }

    /**
     * Handle menu scan
     */
    async handleScan() {
        if (!this.currentFile || this.isProcessing) return;

        const languageSelect = Utils.dom.get('target-language');
        const targetLanguage = languageSelect?.value || 'en';
        const scanBtn = Utils.dom.get('scan-btn');

        try {
            this.isProcessing = true;
            Utils.dom.setLoading(scanBtn, 'Analyzing...');
            
            // Show modal with loading state
            this.showModal();
            this.showLoadingState();

            // Track analytics
            Utils.analytics.track('scan_started', {
                target_language: targetLanguage,
                file_size: this.currentFile.size,
                file_type: this.currentFile.type
            });

            // Track GA4 scan attempt
            trackScanAttempt(targetLanguage);

            // Make API request
            const result = await Utils.api.scanMenu(this.currentFile, targetLanguage);

            if (result.success) {
                this.displayResults(result.data);
                Utils.analytics.trackScan(targetLanguage, true);
                trackScanResult(true, targetLanguage);
                Utils.feedback.showSuccess(CONFIG.SUCCESS_MESSAGES.SCAN_COMPLETE);
            } else {
                this.displayError(result.error);
                Utils.analytics.trackScan(targetLanguage, false);
                trackScanResult(false, targetLanguage);
                Utils.analytics.trackError(result.error, 'scan_menu');
            }

        } catch (error) {
            console.error('Scan error:', error);
            this.displayError(error.message || CONFIG.ERROR_MESSAGES.GENERIC_ERROR);
            Utils.analytics.trackError(error.message, 'scan_exception');
            trackScanResult(false, targetLanguage);
        } finally {
            this.isProcessing = false;
            Utils.dom.removeLoading(scanBtn);
        }
    }

    /**
     * Show modal
     */
    showModal() {
        const modal = Utils.dom.get('result-modal');
        if (modal) {
            Utils.dom.show(modal, 'flex');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        const modal = Utils.dom.get('result-modal');
        if (modal) {
            Utils.dom.hide(modal);
            document.body.style.overflow = 'auto';
        }
    }

    /**
     * Show loading state in modal
     */
    showLoadingState() {
        const resultsContainer = Utils.dom.get('analysis-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">Analyzing your menu...</div>
                <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #64748b;">
                    This usually takes 10-30 seconds
                </p>
            </div>
        `;
    }

    /**
     * Display scan results
     */
    displayResults(data) {
        const resultsContainer = Utils.dom.get('analysis-results');
        if (!resultsContainer) return;

        const { translation, dishes = [], sourceLanguage, targetLanguage } = data;

        let html = `
            <div class="scan-results">
                <div class="results-header">
                    <div class="success-badge">Menu analysis complete!</div>
                    <h2>Menu Translation</h2>
                    <p>From ${CONFIG.getLanguageName(sourceLanguage)} to ${CONFIG.getLanguageName(targetLanguage)}</p>
                </div>
        `;

        if (dishes.length > 0) {
            html += `
                <div class="dishes-list">
                    ${dishes.map(dish => `
                        <div class="dish-card">
                            <h4>${this.escapeHtml(dish.name || 'Unknown Dish')}</h4>
                            ${dish.description ? `<p><strong>Description:</strong> ${this.escapeHtml(dish.description)}</p>` : ''}
                            ${dish.price ? `<p><strong>Price:</strong> ${this.escapeHtml(dish.price)}</p>` : ''}
                            ${dish.ingredients ? `<p><strong>Ingredients:</strong> ${this.escapeHtml(dish.ingredients)}</p>` : ''}
                            ${dish.dietary ? `<p><strong>Dietary Info:</strong> ${this.escapeHtml(dish.dietary)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (translation) {
            html += `
                <div class="raw-response">
                    <h3>Translation</h3>
                    <p>${this.escapeHtml(translation)}</p>
                </div>
            `;
        }

        html += `
                <div class="results-footer">
                    <p>✨ Translation powered by AI • Results may vary</p>
                </div>
            </div>
        `;

        resultsContainer.innerHTML = html;
    }

    /**
     * Display error message
     */
    displayError(errorMessage) {
        const resultsContainer = Utils.dom.get('analysis-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="error-message">
                <h3>Oops! Something went wrong</h3>
                <p>${this.escapeHtml(errorMessage)}</p>
                <button onclick="menuScanner.closeModal()" class="plan-button primary" style="margin-top: 1rem;">
                    Try Again
                </button>
            </div>
        `;
    }

    /**
     * Handle smooth scrolling
     */
    handleSmoothScroll(event) {
        const href = event.target.getAttribute('href');
        if (!href.startsWith('#')) return;

        event.preventDefault();
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
            const headerHeight = document.querySelector('.header')?.offsetHeight || 80;
            const targetPosition = targetElement.offsetTop - headerHeight;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Reset upload state
     */
    resetUpload() {
        this.currentFile = null;
        const uploadArea = Utils.dom.get('upload-area');
        const scanBtn = Utils.dom.get('scan-btn');
        const fileInput = Utils.dom.get('file-input');

        if (fileInput) fileInput.value = '';
        if (scanBtn) scanBtn.disabled = true;

        if (uploadArea) {
            const uploadContent = uploadArea.querySelector('.upload-content');
            if (uploadContent) {
                uploadContent.innerHTML = `
                    <div class="upload-icon">📷</div>
                    <div class="upload-text">
                        <p class="upload-primary">Drop your menu photo here</p>
                        <p class="upload-secondary">or click to browse</p>
                    </div>
                `;
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.menuScanner = new MenuScanner();
});

// Handle page visibility for analytics
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        Utils.analytics.track('page_view', {
            timestamp: Date.now(),
            url: window.location.href
        });
    }
});

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    Utils.analytics.trackError(event.reason?.message || 'Unhandled promise rejection', 'global');
    Utils.feedback.showError(CONFIG.ERROR_MESSAGES.GENERIC_ERROR);
});

// Development helpers
if (CONFIG.DEBUG) {
    window.resetDemo = () => window.menuScanner?.resetUpload();
    console.log('🎯 Main app loaded. Try window.resetDemo() to reset the upload demo.');
}

// Pricing button functions
function scrollToUpload() {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional: highlight the upload area briefly
        uploadArea.style.borderColor = '#0891b2';
        setTimeout(() => {
            uploadArea.style.borderColor = '#cbd5e1';
        }, 2000);
    }
}

async function buyDailyPass() {
    trackPricingClick('daily_pass');
    await initiatePurchase('daily_pass', 'Daily Pass - $1 for unlimited scans (24 hours)');
}

async function buyWeeklyPass() {
    trackPricingClick('weekly_pass');
    await initiatePurchase('weekly_pass', 'Weekly Pass - $5 for unlimited scans (7 days)');
}

// GA4 Tracking Functions
function trackScanAttempt(language) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'scan_attempt', {
            'target_language': language,
            'event_category': 'engagement'
        });
    }
}

function trackScanResult(success, language) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'scan_complete', {
            'success': success,
            'target_language': language,
            'event_category': 'conversion'
        });
    }
}

function trackPricingClick(plan) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'pricing_click', {
            'plan_type': plan,
            'event_category': 'conversion'
        });
    }
}