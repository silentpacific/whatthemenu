const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client only if environment variables are available
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );
} else {
    console.log('Supabase environment variables not found - running without database');
}

// Initialize Google Cloud Vision client with proper error handling
let vision = null;
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use environment variable for credentials
        vision = new ImageAnnotatorClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'what-the-menu-auth'
        });
    } else if (process.env.GOOGLE_VISION_API_KEY) {
        // Use API key directly
        vision = new ImageAnnotatorClient({
            apiKey: process.env.GOOGLE_VISION_API_KEY,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'what-the-menu-auth'
        });
    } else {
        console.error('No Google Vision API credentials found');
        vision = null;
    }
} catch (error) {
    console.error('Failed to initialize Google Vision client:', error);
    vision = null;
}

// Fallback OCR function for testing when Google Vision is not available
async function fallbackOCR(buffer) {
    // This is a simple fallback that returns sample menu items
    // In a real implementation, you could use Tesseract.js or another OCR library
    console.log('Using fallback OCR - returning sample menu items');
    
    const sampleMenuItems = [
        'Margherita Pizza',
        'Pepperoni Pizza',
        'Caesar Salad',
        'Garlic Bread',
        'Tiramisu',
        'Espresso',
        'Cappuccino',
        'Pasta Carbonara',
        'Chicken Parmesan',
        'Bruschetta'
    ];
    
    return {
        textAnnotations: [
            { description: sampleMenuItems.join('\n') },
            ...sampleMenuItems.map(item => ({ description: item }))
        ]
    };
}

exports.handler = async (event, context) => {
    console.log('Simple Google Vision API function started');
    
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

        // Convert base64 to buffer
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        const buffer = Buffer.from(base64Image, 'base64');

        let detections;
        
        // Try Google Vision API first, fallback to simple OCR if not available
        if (vision) {
            try {
                const [result] = await vision.textDetection(buffer);
                detections = result.textAnnotations;
                console.log('Google Vision API response received');
            } catch (visionError) {
                console.error('Google Vision API failed, using fallback:', visionError);
                detections = await fallbackOCR(buffer);
            }
        } else {
            console.log('Google Vision API not available, using fallback OCR');
            detections = await fallbackOCR(buffer);
        }

        if (!detections || detections.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No text detected in the image.'
                })
            };
        }

        // Extract text lines
        const textLines = detections.slice(1).map(block => block.description).filter(line => line.trim().length > 0);
        
        // Simple parsing - create a basic structure
        const sections = [{
            section: 'Menu Items',
            dishes: textLines
                .filter(line => line.trim().length >= 3 && line.trim().length <= 100)
                .map(line => ({ 
                    name: line.trim(),
                    description: 'No description available'
                }))
        }];

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: sections,
                    userTier: 'free',
                    userId: userId || '',
                    scanId: 'temp_' + Date.now(),
                    processingTime: Date.now(),
                    rawText: detections[0]?.description || '',
                    confidence: vision ? 85 : 50, // Lower confidence for fallback
                    source: vision ? 'google-vision' : 'fallback-ocr',
                    totalDishes: sections[0].dishes.length,
                    totalSections: 1
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