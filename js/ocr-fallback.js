// OCR.space API Fallback
class OCRFallback {
    constructor() {
        this.apiKey = 'K81724188988957'; // Free API key (500 requests/day)
        this.apiUrl = 'https://api.ocr.space/parse/image';
    }

    async scanImage(file) {
        try {
            console.log('🔄 Using OCR.space fallback...');
            
            // Convert file to base64
            const base64 = await this.fileToBase64(file);
            
            // Prepare form data
            const formData = new FormData();
            formData.append('apikey', this.apiKey);
            formData.append('base64Image', base64);
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');
            formData.append('filetype', 'png');
            formData.append('detectOrientation', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2'); // Better accuracy

            // Make API request
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`OCR.space API error: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.IsErroredOnProcessing) {
                throw new Error(`OCR.space processing error: ${result.ErrorMessage}`);
            }

            const extractedText = result.ParsedResults?.[0]?.ParsedText || '';
            
            if (!extractedText || extractedText.trim().length < 10) {
                throw new Error('OCR.space could not extract meaningful text from the image.');
            }

            console.log('✅ OCR.space completed successfully');
            
            // Parse the extracted text into menu sections
            const sections = this.parseMenuText(extractedText);
            
            return {
                success: true,
                data: {
                    sections: sections,
                    rawText: extractedText,
                    confidence: 85, // OCR.space doesn't provide confidence, estimate
                    source: 'ocr.space'
                }
            };

        } catch (error) {
            console.error('❌ OCR.space fallback failed:', error);
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
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

// Export for use in other files
window.OCRFallback = OCRFallback; 