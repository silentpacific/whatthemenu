// js/main.js - Main application logic

class MenuScanner {
    constructor() {
        this.currentFile = null;
        this.isProcessing = false;
        this.init();
    }

function getElementById(id) {
    return document.getElementById(id);
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
    // File upload events - simplified version
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const scanBtn = document.getElementById('scan-btn');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    if (uploadArea) {
        uploadArea.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
    }

    // Rest of your existing event handlers...
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
/**
 * Handle menu scan
 */
async handleScan() {
    if (!this.currentFile || this.isProcessing) return;

    const languageSelect = Utils.dom.get('target-language');
    const targetLanguage = languageSelect?.value || 'en';
    const scanBtn = Utils.dom.get('scan-btn');
    const startTime = Date.now(); // Track timing

    try {
        this.isProcessing = true;
        Utils.dom.setLoading(scanBtn, 'Analyzing...');
        
        // Show modal with loading state
        this.showModal();
        this.showLoadingState();

        // Track analytics (existing)
        Utils.analytics.track('scan_started', {
            target_language: targetLanguage,
            file_size: this.currentFile.size,
            file_type: this.currentFile.type
        });

        // Track GA4 scan attempt (existing)
        trackScanAttempt(targetLanguage);

        // 🆕 NEW: Track scan started in Supabase
        await trackScanEvent({
            status: 'started',
            targetLanguage: targetLanguage,
            fileSize: this.currentFile.size
        });

        // Make API request
        const result = await Utils.api.scanMenu(this.currentFile, targetLanguage);
        const processingTime = Date.now() - startTime; // Calculate processing time

        if (result.success) {
            this.displayResults(result.data);
            Utils.analytics.trackScan(targetLanguage, true);
            trackScanResult(true, targetLanguage);
            Utils.feedback.showSuccess(CONFIG.SUCCESS_MESSAGES.SCAN_COMPLETE);

            // 🆕 NEW: Track successful scan in Supabase
            await trackScanEvent({
                status: 'success',
                targetLanguage: targetLanguage,
                sourceLanguage: result.data.sourceLanguage,
                fileSize: this.currentFile.size,
                processingTime: processingTime,
                dishesFound: result.data.dishes?.length || 0
            });

        } else {
            this.displayError(result.error);
            Utils.analytics.trackScan(targetLanguage, false);
            trackScanResult(false, targetLanguage);
            Utils.analytics.trackError(result.error, 'scan_menu');

            // 🆕 NEW: Track failed scan in Supabase
            await trackScanEvent({
                status: 'failed',
                targetLanguage: targetLanguage,
                fileSize: this.currentFile.size,
                processingTime: processingTime,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Scan error:', error);
        this.displayError(error.message || CONFIG.ERROR_MESSAGES.GENERIC_ERROR);
        Utils.analytics.trackError(error.message, 'scan_exception');
        trackScanResult(false, targetLanguage);

        // 🆕 NEW: Track error in Supabase
        await trackScanEvent({
            status: 'failed',
            targetLanguage: targetLanguage,
            fileSize: this.currentFile.size,
            processingTime: Date.now() - startTime,
            error: error.message
        });

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

// Initialize Supabase
const SUPABASE_URL = 'https://tibeuchezcksymjivgwr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYmV1Y2hlemNrc3ltaml2Z3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwMTQyNDAsImV4cCI6MjA2NjU5MDI0MH0.hx8ocUMZQaAvo50L_KtI9FuH4lklAT5N1th-H4njVrw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {



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
    
    // Track in Supabase
    await trackUserEvent('pricing_click', { 
        plan_type: 'daily_pass',
        price: 100 // cents
    });
    
    await initiatePurchase('daily_pass', 'Daily Pass - $1 for unlimited scans (24 hours)');
}

async function buyWeeklyPass() {
    trackPricingClick('weekly_pass');
    
    // Track in Supabase
    await trackUserEvent('pricing_click', { 
        plan_type: 'weekly_pass',
        price: 500 // cents
    });
    
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

// Add these to your main.js file

// Generate a session ID for tracking
function getSessionId() {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

// Track scan event in Supabase
async function trackScanEvent(eventData) {
    try {
        const { error } = await supabase.from('scan_events').insert({
            session_id: getSessionId(),
            source_language: eventData.sourceLanguage || null,
            target_language: eventData.targetLanguage,
            scan_status: eventData.status,
            error_reason: eventData.error || null,
            file_size_bytes: eventData.fileSize || null,
            processing_time_ms: eventData.processingTime || null,
            dishes_found: eventData.dishesFound || 0,
            user_agent: navigator.userAgent,
            // You can add IP/location detection here if needed
        });
        
        if (error) {
            console.error('Error tracking scan event:', error);
        }
    } catch (error) {
        console.error('Error tracking scan event:', error);
    }
}

// Track user analytics event
async function trackUserEvent(eventType, eventData = {}) {
    try {
        const { error } = await supabase.from('user_analytics').insert({
            session_id: getSessionId(),
            event_type: eventType,
            event_data: eventData,
            page_url: window.location.href,
            referrer: document.referrer || null,
            device_type: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        });
        
        if (error) {
            console.error('Error tracking user event:', error);
        }
    } catch (error) {
        console.error('Error tracking user event:', error);
    }
}

// Check if user has active subscription
async function checkActiveSubscription() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        const { data, error } = await supabase.rpc('get_user_active_subscription', {
            user_uuid: user.id
        });
        
        if (error) {
            console.error('Error checking subscription:', error);
            return null;
        }
        
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error checking subscription:', error);
        return null;
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


// ADD ALL THE HELPER FUNCTIONS HERE:
// Generate a session ID for tracking
function getSessionId() {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
}

// Track scan event in Supabase
async function trackScanEvent(eventData) {
    try {
        const { error } = await supabase.from('scan_events').insert({
            session_id: getSessionId(),
            source_language: eventData.sourceLanguage || null,
            target_language: eventData.targetLanguage,
            scan_status: eventData.status,
            error_reason: eventData.error || null,
            file_size_bytes: eventData.fileSize || null,
            processing_time_ms: eventData.processingTime || null,
            dishes_found: eventData.dishesFound || 0,
            user_agent: navigator.userAgent,
        });
        
        if (error) {
            console.error('Error tracking scan event:', error);
        }
    } catch (error) {
        console.error('Error tracking scan event:', error);
    }
}

// Track user analytics event
async function trackUserEvent(eventType, eventData = {}) {
    try {
        const { error } = await supabase.from('user_analytics').insert({
            session_id: getSessionId(),
            event_type: eventType,
            event_data: eventData,
            page_url: window.location.href,
            referrer: document.referrer || null,
            device_type: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent) ? 'mobile' : 'desktop',
        });
        
        if (error) {
            console.error('Error tracking user event:', error);
        }
    } catch (error) {
        console.error('Error tracking user event:', error);
    }
}

// Check if user has active subscription
async function checkActiveSubscription() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        const { data, error } = await supabase.rpc('get_user_active_subscription', {
            user_uuid: user.id
        });
        
        if (error) {
            console.error('Error checking subscription:', error);
            return null;
        }
        
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error checking subscription:', error);
        return null;
    }
}