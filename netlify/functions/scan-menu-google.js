const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

// Initialize Google Cloud Vision client
const vision = new ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-vision-api.json'
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
    const startTime = Date.now();
    console.log('Google Vision API function started');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };
    }

    try {
        const { image, userId, sessionId } = JSON.parse(event.body || '{}');
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        // Preprocess image for better OCR
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        const buffer = Buffer.from(base64Image, 'base64');
        
        // Apply preprocessing for better OCR results
        const processedBuffer = await sharp(buffer)
            .resize(2048, null, { withoutEnlargement: true })
            .sharpen(1, 1, 2)
            .normalize()
            .jpeg({ quality: 90 })
            .toBuffer();

        // Use Google Vision API for OCR
        const [result] = await vision.textDetection(processedBuffer);
        const detections = result.textAnnotations;
        
        if (!detections || detections.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No text detected in the image. Please ensure the menu is clearly visible and well-lit.'
                })
            };
        }

        // Extract text lines
        const textLines = detections.slice(1).map(block => block.description).filter(line => line.trim().length > 0);
        
        // Simple parsing - create sections based on common patterns
        const sections = [];
        let currentSection = { section: 'Menu Items', dishes: [] };
        
        for (const line of textLines) {
            const cleanLine = line.trim();
            if (cleanLine.length < 3 || cleanLine.length > 100) continue;
            
            // Skip price-only lines
            if (/^\$?\d+\.?\d*$/.test(cleanLine)) continue;
            
            // Check if it's a section header
            const sectionKeywords = ['appetizers', 'starters', 'entrees', 'mains', 'desserts', 'drinks', 'beverages'];
            const isSection = sectionKeywords.some(keyword => 
                cleanLine.toLowerCase().includes(keyword)
            );
            
            if (isSection) {
                if (currentSection.dishes.length > 0) {
                    sections.push(currentSection);
                }
                currentSection = { section: cleanLine, dishes: [] };
            } else {
                currentSection.dishes.push({ name: cleanLine });
            }
        }
        
        if (currentSection.dishes.length > 0) {
            sections.push(currentSection);
        }

        // Enrich with descriptions from Supabase
        const { data: availableDishes } = await supabase
            .from('dishes')
            .select('name, explanation');
        
        const enrichedSections = sections.map(section => ({
            ...section,
            dishes: section.dishes.map(dish => {
                const match = availableDishes?.find(d => 
                    d.name.toLowerCase().includes(dish.name.toLowerCase()) ||
                    dish.name.toLowerCase().includes(d.name.toLowerCase())
                );
                return {
                    ...dish,
                    description: match?.explanation || 'No description available'
                };
            })
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: enrichedSections,
                    userTier: 'free',
                    userId: userId || '',
                    scanId: 'temp_' + Date.now(),
                    processingTime: Date.now() - startTime,
                    rawText: detections[0]?.description || '',
                    confidence: 85,
                    source: 'google-vision',
                    totalDishes: enrichedSections.reduce((sum, section) => sum + section.dishes.length, 0),
                    totalSections: enrichedSections.length
                }
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to process menu image: ' + error.message
            })
        };
    }
}; 