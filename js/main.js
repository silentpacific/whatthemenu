// js/main.js - Updated with better error handling and debugging

class MenuScanner {
    constructor() {
        this.currentFile = null;
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.bindEvents();
        console.log('🚀 MenuScanner initialized');
    }

    bindEvents() {
        // Get elements using standard JavaScript
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.getElementById('upload-area');
        const scanBtn = document.getElementById('scan-btn');

        // File input change event
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.processFile(file);
                }
            });
        }

        // Upload area click event
        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                if (fileInput) {
                    fileInput.click();
                }
            });

            // Drag and drop events
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.processFile(files[0]);
                }
            });
        }

        // Scan button event
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                this.handleScan();
            });
        }

        // Close modal events
        const closeModal = document.getElementById('close-modal');
        const modal = document.getElementById('result-modal');

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
    }

    processFile(file) {
        console.log('File selected:', file.name);
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('File too large. Please select an image smaller than 10MB');
            return;
        }

        this.currentFile = file;
        this.updateUploadUI(file);
        this.enableScanButton();
    }

    updateUploadUI(file) {
        const uploadArea = document.getElementById('upload-area');
        if (!uploadArea) return;

        const uploadContent = uploadArea.querySelector('.upload-content');
        if (!uploadContent) return;

        uploadContent.innerHTML = `
            <div class="upload-icon">📎</div>
            <div class="upload-text">
                <p class="upload-primary">${file.name}</p>
                <p class="upload-secondary">${this.formatFileSize(file.size)} • Click to change</p>
            </div>
        `;
    }

    enableScanButton() {
        const scanBtn = document.getElementById('scan-btn');
        if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan Menu';
        }
    }

    async handleScan() {
        if (!this.currentFile) {
            alert('Please select an image first');
            return;
        }

        if (this.isProcessing) return;

        console.log('🔍 Starting scan process...');
        this.isProcessing = true;
        
        const scanBtn = document.getElementById('scan-btn');
        if (scanBtn) {
            scanBtn.disabled = true;
            scanBtn.textContent = 'Analyzing...';
        }

        try {
            // Show modal
            this.showModal();
            this.showLoadingState();

            // Call Netlify function
            const result = await this.callNetlifyFunction(this.currentFile);
            
            console.log('🔍 Scan result:', result);

            if (result.success) {
                console.log('✅ Scan successful, redirecting to results...');
                this.displayResults(result.data);
                sessionStorage.setItem('menuResults', JSON.stringify(resultsData));
                sessionStorage.setItem('userId', data.userId || '');
                sessionStorage.setItem('scanId', data.scanId || '');
            } else {
                console.error('❌ Scan failed:', result.error);
                this.displayError(result.error || 'Analysis failed. Please try again.');
            }

        } catch (error) {
            console.error('❌ Scan error:', error);
            this.displayError('Network error. Please check your connection and try again.');
        } finally {
            this.isProcessing = false;
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.textContent = 'Scan Menu';
            }
        }
    }

    async callNetlifyFunction(file) {
        const base64 = await this.fileToBase64(file);
    
        // Get userId from Supabase Auth (if available)
        let userId = null;
        if (window.supabase) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                userId = user?.id || null;
            } catch (e) {
                userId = null;
            }
        }
    
        // Always use a sessionId for anonymous users
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'sess_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
            sessionStorage.setItem('sessionId', sessionId);
        }
    
        try {
            const response = await fetch('/.netlify/functions/scan-menu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64,
                    userId: userId,      // may be null
                    sessionId: sessionId // always present
                })
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
    
            const result = await response.json();
            // Save userId and scanId for results page
            if (result.success && result.data) {
                sessionStorage.setItem('userId', result.data.userId || '');
                sessionStorage.setItem('scanId', result.data.scanId || '');
            }
            return result;
    
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to connect to server'
            };
        }
    }

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.menuScanner = new MenuScanner();
});

// Pricing button functions
function scrollToUpload() {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
        uploadArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function setupDishClickHandlers(userId, scanId) {
    const sessionId = sessionStorage.getItem('sessionId');
    document.querySelectorAll('.dish-name').forEach(el => {
        el.addEventListener('click', async function() {
            const dishName = this.dataset.dishName;
            const dishDesc = this.dataset.dishDesc || '';
            const explanationEl = this.nextElementSibling;

            explanationEl.textContent = 'Loading explanation...';

            const response = await fetch('/.netlify/functions/get-dish-explanation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: dishName,
                    description: dishDesc,
                    userId: userId || null,
                    sessionId: sessionId,
                    scanId: scanId
                })
            });
            const result = await response.json();

            if (result.success) {
                explanationEl.textContent = result.explanation;
            } else {
                explanationEl.textContent = result.error || 'Could not fetch explanation.';
            }
        });
    });
}