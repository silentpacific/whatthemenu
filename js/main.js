// js/main.js - Clean working version

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

        console.log('Starting scan...');
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

            // Call OpenAI API
            const result = await this.callOpenAI(this.currentFile);
            
            if (result.success) {
                this.displayResults(result.data);
            } else {
                this.displayError(result.error);
            }

        } catch (error) {
            console.error('Scan error:', error);
            this.displayError('Something went wrong. Please try again.');
        } finally {
            this.isProcessing = false;
            if (scanBtn) {
                scanBtn.disabled = false;
                scanBtn.textContent = 'Scan Menu';
            }
        }
    }

    async callOpenAI(file) {
        // Convert file to base64
        const base64 = await this.fileToBase64(file);
        
        try {
            const response = await fetch(CONFIG.OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4-vision-preview",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Please analyze this menu image and extract all the dishes with their descriptions and prices. Format the response as JSON with an array of dishes, each containing: name, description, price. If you can detect the original language, include it as 'sourceLanguage'."
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64}`
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 1000
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Try to parse JSON response
            try {
                const parsedContent = JSON.parse(content);
                return {
                    success: true,
                    data: {
                        dishes: parsedContent.dishes || [],
                        sourceLanguage: parsedContent.sourceLanguage || 'unknown',
                        targetLanguage: 'en'
                    }
                };
            } catch (e) {
                // If not JSON, return as plain text
                return {
                    success: true,
                    data: {
                        translation: content,
                        dishes: [],
                        sourceLanguage: 'unknown',
                        targetLanguage: 'en'
                    }
                };
            }

        } catch (error) {
            console.error('OpenAI API error:', error);
            return {
                success: false,
                error: error.message
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
        const resultsContainer = document.getElementById('analysis-results');
        if (!resultsContainer) return;

        const { translation, dishes = [], sourceLanguage, targetLanguage } = data;

        let html = `
            <div class="scan-results">
                <div class="results-header">
                    <div class="success-badge">Menu analysis complete!</div>
                    <h2>Menu Translation</h2>
                    <p>Extracted from menu</p>
                </div>
        `;

        if (dishes.length > 0) {
            html += `
                <div class="dishes-list">
                    ${dishes.map(dish => `
                        <div class="dish-card">
                            <h4>${dish.name || 'Unknown Dish'}</h4>
                            ${dish.description ? `<p><strong>Description:</strong> ${dish.description}</p>` : ''}
                            ${dish.price ? `<p><strong>Price:</strong> ${dish.price}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (translation) {
            html += `
                <div class="raw-response">
                    <h3>Menu Content</h3>
                    <p>${translation}</p>
                </div>
            `;
        }

        html += `
                <div class="results-footer">
                    <p>✨ Powered by AI • Results may vary</p>
                </div>
            </div>
        `;

        resultsContainer.innerHTML = html;
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