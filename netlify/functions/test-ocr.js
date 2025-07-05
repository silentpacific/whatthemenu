const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Initialize Google Cloud Vision client with proper error handling
let vision = null;
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        vision = new ImageAnnotatorClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'what-the-menu-auth'
        });
    } else if (process.env.GOOGLE_VISION_API_KEY) {
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

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    try {
        if (event.httpMethod === 'GET') {
            // Return configuration status
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    googleVisionConfigured: !!vision,
                    environmentVariables: {
                        hasGoogleVisionApiKey: !!process.env.GOOGLE_VISION_API_KEY,
                        hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
                        hasGoogleCloudProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
                        hasSupabaseUrl: !!process.env.SUPABASE_URL,
                        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY
                    },
                    message: vision ? 'Google Vision API is configured and ready' : 'Google Vision API not configured - will use fallback'
                })
            };
        }

        if (event.httpMethod === 'POST') {
            const { image } = JSON.parse(event.body || '{}');
            
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

            if (vision) {
                try {
                    const [result] = await vision.textDetection(buffer);
                    const detections = result.textAnnotations;
                    
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            source: 'google-vision',
                            textDetected: detections && detections.length > 0,
                            rawText: detections?.[0]?.description || '',
                            confidence: 'high'
                        })
                    };
                } catch (error) {
                    return {
                        statusCode: 500,
                        headers,
                        body: JSON.stringify({
                            success: false,
                            error: 'Google Vision API error: ' + error.message
                        })
                    };
                }
            } else {
                // Fallback response
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        source: 'fallback',
                        textDetected: true,
                        rawText: 'Sample menu items (fallback mode)',
                        confidence: 'low',
                        message: 'Google Vision API not configured - this is a test response'
                    })
                };
            }
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Test function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false,
                error: 'Test function failed: ' + error.message
            })
        };
    }
}; 