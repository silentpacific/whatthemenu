// Tesseract.js OCR Scanner
class TesseractScanner {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Load Tesseract.js from CDN if not already loaded
            if (typeof Tesseract === 'undefined') {
                await this.loadTesseractScript();
            }
            
            // Initialize Tesseract worker
            this.worker = await Tesseract.createWorker('eng');
            this.isInitialized = true;
            console.log('✅ Tesseract.js initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Tesseract.js:', error);
            throw error;
        }
    }

    async loadTesseractScript() {
        return new Promise((resolve, reject) => {
            if (typeof Tesseract !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@v4.1.1/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async scanImage(imageFile) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            console.log('🔍 Starting Tesseract OCR scan...');
            
            // Convert file to base64
            const base64 = await this.fileToBase64(imageFile);
            
            // Perform OCR
            const result = await this.worker.recognize(base64);
            console.log('✅ OCR completed:', result.data.text);
            
            // Parse the extracted text into menu sections
            const sections = this.parseMenuText(result.data.text);
            
            return {
                success: true,
                data: {
                    sections: sections,
                    rawText: result.data.text,
                    confidence: result.data.confidence
                }
            };
        } catch (error) {
            console.error('❌ OCR scan failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    parseMenuText(text) {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        const sections = [];
        let currentSection = null;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip lines that are likely prices, numbers, or too short
            if (trimmedLine.length < 3 || 
                /^\d+\.?\d*$/.test(trimmedLine) || 
                /^\$?\d+\.?\d*$/.test(trimmedLine) ||
                /^[0-9\s\.\$]+$/.test(trimmedLine)) {
                continue;
            }
            
            // Check if this looks like a section header
            const sectionKeywords = [
                'APPETIZERS', 'STARTERS', 'MAIN', 'ENTREES', 'DESSERTS', 
                'DRINKS', 'BEVERAGES', 'SALADS', 'SOUPS', 'PASTA', 
                'PIZZA', 'BURGERS', 'SANDWICHES', 'SPECIALS', 'CHEF'
            ];
            
            const isSectionHeader = sectionKeywords.some(keyword => 
                trimmedLine.toUpperCase().includes(keyword) || 
                (trimmedLine.length < 25 && trimmedLine === trimmedLine.toUpperCase())
            );
            
            if (isSectionHeader) {
                if (currentSection && currentSection.dishes.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = {
                    name: trimmedLine,
                    dishes: []
                };
            } else if (currentSection) {
                // This is likely a dish name
                currentSection.dishes.push({
                    name: trimmedLine
                });
            } else {
                // No section yet, create a default one
                currentSection = {
                    name: 'Menu Items',
                    dishes: [{
                        name: trimmedLine
                    }]
                };
            }
        }
        
        // Add the last section if it has dishes
        if (currentSection && currentSection.dishes.length > 0) {
            sections.push(currentSection);
        }
        
        // If no sections were found, create one with all items
        if (sections.length === 0) {
            const allDishes = lines
                .filter(line => {
                    const trimmed = line.trim();
                    return trimmed.length > 3 && 
                           !/^\d+\.?\d*$/.test(trimmed) &&
                           !/^[0-9\s\.\$]+$/.test(trimmed);
                })
                .map(line => ({ name: line.trim() }));
            
            if (allDishes.length > 0) {
                sections.push({
                    name: 'Menu Items',
                    dishes: allDishes
                });
            }
        }
        
        return sections;
    }

    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }
}

// Export for use in other files
window.TesseractScanner = TesseractScanner; 