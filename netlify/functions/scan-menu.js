// netlify/functions/scan-menu.js - Menu scanning serverless function

const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Supported languages mapping
const LANGUAGE_NAMES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'th': 'Thai',
    'vi': 'Vietnamese',
    'nl': 'Dutch',
    'sv': 'Swedish'
};

// Rate limiting (simple in-memory store - use Redis in production)
const rateLimits = new Map();

/**
 * Check rate limit for IP
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 10; // 10 requests per 15 minutes for free users

    if (!rateLimits.has(ip)) {
        rateLimits.set(ip, []);
    }

    const requests = rateLimits.get(ip);
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
        return false;
    }

    validRequests.push(now);
    rateLimits.set(ip, validRequests);
    return true;
}

/**
 * Extract base64 image data from data URL
 */
function extractBase64Image(dataUrl) {
    if (!dataUrl || !dataUrl.includes('base64,')) {
        throw new Error('Invalid image data format');
    }
    return dataUrl.split('base64,')[1];
}

/**
 * Validate image format and size
 */
function validateImage(base64Data) {
    // Check if base64 data is valid
    if (!base64Data) {
        throw new Error('No image data provided');
    }

    // Estimate file size (base64 is ~33% larger than binary)
    const sizeEstimate = (base64Data.length * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (sizeEstimate > maxSize) {
        throw new Error('Image file too large. Maximum size is 10MB.');
    }

    return true;
}

/**
 * Create optimized prompt for menu analysis
 */
function createMenuPrompt(targetLanguage) {
    const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    
    return `You are a professional menu translator and food expert. Analyze this menu image and provide a translation to ${languageName}.

INSTRUCTIONS:
1. Extract all text from the menu image using OCR
2. Identify the source language
3. Translate menu items to ${languageName}
4. For each dish, provide:
   - Name (translated)
   - Description (if available)
   - Price (if visible)
   - Key ingredients (if mentioned)
   - Dietary information (vegetarian, vegan, gluten-free, etc.)

FORMAT YOUR RESPONSE AS JSON:
{
  "sourceLanguage": "detected_language_code",
  "targetLanguage": "${targetLanguage}",
  "dishes": [
    {
      "name": "Translated dish name",
      "description": "Translated description",
      "price": "Price if visible",
      "ingredients": "Key ingredients if mentioned",
      "dietary": "Dietary info like vegetarian, vegan, etc"
    }
  ],
  "translation": "Full menu translation if dishes format not applicable"
}

IMPORTANT:
- Be accurate with translations
- Include cultural context when helpful
- If you can't clearly read the menu, say so
- Only include fields that have actual content
- Use proper JSON formatting
- If the image contains no menu text, return an error message`;
}

/**
 * Main function handler
 */
exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Check environment variables
        if (!process.env.OPENAI_API_KEY) {
            console.error('Missing OPENAI_API_KEY environment variable');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Server configuration error' })
            };
        }

        // Rate limiting
        const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
        if (!checkRateLimit(clientIP)) {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ 
                    error: 'Rate limit exceeded. Please try again in 15 minutes.' 
                })
            };
        }

        // Parse request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { image, targetLanguage = 'en' } = requestBody;

        // Validate required fields
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Image data is required' })
            };
        }

        if (!LANGUAGE_NAMES[targetLanguage] && targetLanguage !== 'en') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Unsupported target language' })
            };
        }

        // Extract and validate image
        const base64Image = extractBase64Image(image);
        validateImage(base64Image);

        // Determine image format from data URL
        const mimeType = image.split(';')[0].split(':')[1];
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mimeType)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Unsupported image format. Use JPG, PNG, or WebP.' })
            };
        }

        console.log(`Processing menu scan for language: ${targetLanguage}`);

        // Call OpenAI Vision API
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: createMenuPrompt(targetLanguage)
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        });

        const aiResponse = response.choices[0]?.message?.content;
        
        if (!aiResponse) {
            throw new Error('No response from AI service');
        }

        // Try to parse JSON response
        let parsedResponse;
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
            parsedResponse = JSON.parse(jsonString);
        } catch (error) {
            console.warn('Failed to parse AI response as JSON, using raw text');
            parsedResponse = {
                sourceLanguage: 'unknown',
                targetLanguage: targetLanguage,
                translation: aiResponse,
                dishes: []
            };
        }

        // Ensure required fields exist
        const result = {
            sourceLanguage: parsedResponse.sourceLanguage || 'unknown',
            targetLanguage: targetLanguage,
            dishes: parsedResponse.dishes || [],
            translation: parsedResponse.translation || null,
            timestamp: new Date().toISOString()
        };

        console.log(`Menu scan completed successfully. Found ${result.dishes.length} dishes.`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Menu scan error:', error);

        // Return appropriate error response
        let errorMessage = 'Failed to analyze menu';
        let statusCode = 500;

        if (error.message.includes('Invalid image') || error.message.includes('too large')) {
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.message.includes('rate limit') || error.code === 'rate_limit_exceeded') {
            errorMessage = 'API rate limit exceeded. Please try again later.';
            statusCode = 429;
        } else if (error.message.includes('insufficient_quota')) {
            errorMessage = 'Service temporarily unavailable. Please try again later.';
            statusCode = 503;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({ 
                error: errorMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
};