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
        // Convert file to base64
        const base64 = await this.fileToBase64(file);

        console.log('🔍 Calling Netlify function with file:', file.name);
        
        try {
            const response = await fetch('/.netlify/functions/scan-menu', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: base64,
                    targetLanguage: 'en',
                    userId: null,
                    sessionId: this.generateSessionId(),
                    userFingerprint: this.generateFingerprint()
                })
            });

            console.log('🔍 Response status:', response.status);
            console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Function error response:', errorText);
                throw new Error(`Server error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('🔍 Function result:', result);

            return result;

        } catch (error) {
            console.error('❌ Network/Function error:', error);
            return {
                success: false,
                error: error.message || 'Failed to connect to server'
            };
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    }

    generateFingerprint() {
        return 'fp_' + Math.random().toString(36).substr(2, 12);
    }

    showModal() {
        const modal = document.getElementById('result-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    showLoadingState() {
        const resultsContainer = document.getElementById('analysis-results');
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

    displayResults(data) {
        console.log('📊 Displaying results:', data);
        
        // Save results to sessionStorage for the results page
        const resultsData = {
            sections: data.sections || [],
            timestamp: Date.now(),
            sourceLanguage: data.sourceLanguage || 'unknown',
            targetLanguage: data.targetLanguage || 'en',
            confidence: data.confidence || 0.9,
            warnings: data.warnings || [],
            dishesFound: data.dishesFound || 0,
            processingTime: data.processingTime || 0
        };
        
        console.log('💾 Saving to sessionStorage:', resultsData);
        sessionStorage.setItem('menuResults', JSON.stringify(resultsData));
        
        // Small delay to ensure data is saved
        setTimeout(() => {
            console.log('🔄 Redirecting to results page...');
            window.location.href = 'results.html';
        }, 100);
    }

    displayError(errorMessage) {
        const resultsContainer = document.getElementById('analysis-results');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="error-message">
                <h3>Oops! Something went wrong</h3>
                <p>${errorMessage}</p>
                <button onclick="menuScanner.closeModal()" class="plan-button primary" style="margin-top: 1rem;">
                    Try Again
                </button>
            </div>
        `;
    }

    closeModal() {
        const modal = document.getElementById('result-modal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

function setupDishClickHandlers() {
    document.querySelectorAll('.dish-name').forEach(el => {
        el.addEventListener('click', async function() {
            const dishName = this.dataset.dishName;
            const dishDesc = this.dataset.dishDesc || '';
            const explanationEl = this.nextElementSibling;

            // Show loading state
            explanationEl.textContent = 'Loading explanation...';

            // Fetch explanation from Netlify function
            const response = await fetch('/.netlify/functions/get-dish-explanation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: dishName, description: dishDesc })
            });
            const result = await response.json();

            if (result.success) {
                explanationEl.textContent = result.explanation;
            } else {
                explanationEl.textContent = 'Could not fetch explanation.';
            }
        });
    });
}