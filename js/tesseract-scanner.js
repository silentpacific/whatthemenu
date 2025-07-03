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

    async scanImage(file) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            console.log('🔍 Starting Tesseract OCR scan...');
            
            // Validate file
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('Invalid file type. Please upload an image.');
            }

            // Convert file to proper format for Tesseract
            const imageUrl = await this.fileToImageUrl(file);
            
            // Perform OCR with better error handling and timeout
            console.log('📸 Processing image with Tesseract...');
            
            // Add timeout to prevent hanging (15 seconds should be enough)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('OCR processing timed out')), 15000); // 15 second timeout
            });
            
            const ocrPromise = this.worker.recognize(imageUrl);
            
            const result = await Promise.race([ocrPromise, timeoutPromise]);
            
            console.log('✅ OCR completed:', result.data.text);
            
            // Check if we got any meaningful text
            if (!result.data.text || result.data.text.trim().length < 10) {
                throw new Error('OCR could not extract meaningful text from the image. Please try a clearer image.');
            }
            
            // Parse the extracted text into menu sections
            const sections = this.parseMenuText(result.data.text);
            
            // Check if we found any dishes
            const totalDishes = sections.reduce((sum, section) => sum + (section.dishes?.length || 0), 0);
            if (totalDishes === 0) {
                throw new Error('No menu items could be identified. Please try a clearer image or different menu.');
            }
            
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

            // Always treat error as string
            let errorMessage = '';
            if (typeof error === 'string') {
                errorMessage = error;
            } else if (error && typeof error.message === 'string') {
                errorMessage = error.message;
            } else {
                errorMessage = JSON.stringify(error);
            }

            // Provide helpful error messages
            if (errorMessage.includes('SetImageFile')) {
                errorMessage = 'Image processing failed. Please try a different image format (JPG, PNG).';
            } else if (errorMessage.includes('timeout')) {
                errorMessage = 'Processing took too long. Please try a smaller or clearer image.';
            } else if (errorMessage.includes('meaningful text')) {
                errorMessage = 'Could not read text from this image. Please ensure the image is clear and contains readable text.';
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    async fileToImageUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    // Create an image element to validate and process
                    const img = new Image();
                    img.onload = () => {
                        // Create a canvas to ensure proper format and optimize for OCR
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Calculate optimal size for OCR (not too large, not too small)
                        const maxSize = 1200;
                        let { width, height } = img;
                        
                        if (width > maxSize || height > maxSize) {
                            const ratio = Math.min(maxSize / width, maxSize / height);
                            width = Math.floor(width * ratio);
                            height = Math.floor(height * ratio);
                        }
                        
                        // Set canvas size
                        canvas.width = width;
                        canvas.height = height;
                        
                        // Apply image processing for better OCR
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, width, height);
                        
                        // Draw image with smoothing disabled for better text recognition
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Apply contrast enhancement for better OCR
                        const imageData = ctx.getImageData(0, 0, width, height);
                        const data = imageData.data;
                        
                        // Simple contrast enhancement
                        for (let i = 0; i < data.length; i += 4) {
                            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                            const threshold = 128;
                            const value = avg > threshold ? 255 : 0;
                            data[i] = value;     // Red
                            data[i + 1] = value; // Green
                            data[i + 2] = value; // Blue
                            // Alpha stays the same
                        }
                        
                        ctx.putImageData(imageData, 0, 0);
                        
                        // Convert to data URL with high quality
                        const dataUrl = canvas.toDataURL('image/png', 1.0);
                        console.log('🖼️ Image processed for OCR:', width + 'x' + height);
                        resolve(dataUrl);
                    };
                    img.onerror = () => reject(new Error('Failed to load image'));
                    img.src = reader.result;
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
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