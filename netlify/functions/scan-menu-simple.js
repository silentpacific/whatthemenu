const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);



// Initialize Google Cloud Vision client
const vision = new ImageAnnotatorClient({
    keyFilename: './google-vision-api.json',
    projectId: 'what-the-menu-auth'
});

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

        // Use Google Vision API for OCR
        const [result] = await vision.textDetection(buffer);
        const detections = result.textAnnotations;
        
        console.log('Google Vision API response received');

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
                    confidence: 85,
                    source: 'google-vision',
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