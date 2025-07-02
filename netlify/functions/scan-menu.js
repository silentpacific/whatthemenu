// netlify/functions/scan-menu.js

const vision = require('@google-cloud/vision');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const visionClient = new vision.ImageAnnotatorClient({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    credentials: {
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    },
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Extract text from image using Google Cloud Vision with enhanced settings
 */
async function extractTextFromImage(base64Image) {
    try {
        console.log('🔍 Starting Google Cloud Vision DOCUMENT text extraction...');
        
        const [result] = await visionClient.documentTextDetection({
            image: {
                content: base64Image,
            },
            imageContext: {
                languageHints: ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'th', 'vi'],
            },
        });

        const fullTextAnnotation = result.fullTextAnnotation;
        if (!fullTextAnnotation || !fullTextAnnotation.text) {
            throw new Error('No text detected in image');
        }

        // This gives you the full text, and you can also access blocks, paragraphs, words, etc.
        return {
            fullText: fullTextAnnotation.text,
            blocks: fullTextAnnotation.pages?.[0]?.blocks || [],
            detectedLanguages: fullTextAnnotation.pages?.[0]?.property?.detectedLanguages || []
        };
    } catch (error) {
        console.error('❌ Google Vision API error:', error);
        throw new Error(`Text extraction failed: ${error.message}`);
    }
}

/**
 * Enhanced menu text parser with better layout detection
 */
/**
 * Enhanced menu parser using Google Vision blocks and paragraphs
 */
/**
 * Simple line-based menu parser (Tesseract-style)
 */
function parseMenuText(ocrText) {
    const lines = ocrText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const sections = [];
    let currentSection = { name: 'Main Dishes', dishes: [] };
    let currentDish = null;
    let dishBuffer = [];

    // You can expand this list for more menu types
    const sectionTitles = [
        'STARTERS', 'PASTA SAUCE', 'RISOTTO', 'SIDES', 'CHOICE OF PASTA', 'ADD PASTA TOPPINGS'
    ];
    const priceRegex = /\$?\d+[.,]?\d*/;

    for (let line of lines) {
        // Section headers
        if (sectionTitles.includes(line.toUpperCase())) {
            if (currentSection.dishes.length > 0) sections.push(currentSection);
            currentSection = { name: line, dishes: [] };
            currentDish = null;
            dishBuffer = [];
            continue;
        }
        // Dish name: line ends with price (e.g. ...$9.9) or is bold/capitalized
        if (priceRegex.test(line) && !line.toLowerCase().includes('option')) {
            if (currentDish && dishBuffer.length > 0) {
                currentDish.description = dishBuffer.join(' ').trim();
                currentSection.dishes.push(currentDish);
            }
            currentDish = { name: line, description: '' };
            dishBuffer = [];
            continue;
        }
        // Description: follows a dish name
        if (currentDish) {
            dishBuffer.push(line);
        }
    }
    // Save the last dish
    if (currentDish && dishBuffer.length > 0) {
        currentDish.description = dishBuffer.join(' ').trim();
        currentSection.dishes.push(currentDish);
    }
    if (currentSection.dishes.length > 0) sections.push(currentSection);
    return sections;
}

/**
 * Batch lookup dish explanations in Supabase
 * @param {Array} dishes - Array of { name }
 * @param {string} language
 * @returns {Object} Map of dish name to explanation
 */
async function lookupDishesInSupabase(dishes, language = 'en') {
    const names = dishes.map(d => d.name);
    const { data, error } = await supabase
        .from('dishes')
        .select('name, explanation')
        .in('name', names)
        .eq('language', language);
    if (error) {
        console.error('Supabase lookup error:', error);
        return {};
    }
    const map = {};
    for (const row of data) {
        map[row.name] = row.explanation;
    }
    return map;
}

/**
 * Query OpenAI for missing dish explanations and save to Supabase
 * @param {Array} dishes - Array of { name, description, dietary }
 * @param {string} language
 * @returns {Object} Map of dish name to explanation
 */
async function fetchAndSaveExplanationsFromOpenAI(dishes, language = 'en') {
    const map = {};
    for (const dish of dishes) {
        const prompt = `Explain the following dish for a menu in a friendly, concise way (max 60 words). Include dietary notes if available.\n\nDish: ${dish.name}\nDescription: ${dish.description}\nDietary: ${dish.dietary.join(', ')}`;
        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: 'You are a helpful food explainer. Respond with a short, clear explanation.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 200,
                temperature: 0.4
            });
            const explanation = completion.choices[0]?.message?.content?.trim();
            map[dish.name] = explanation;
            // Save to Supabase
            await supabase.from('dishes').insert([
                {
                    name: dish.name,
                    explanation,
                    language,
                    cuisine_type: null,
                    dietary_tags: dish.dietary,
                    confidence_score: 0.9
                }
            ]);
        } catch (error) {
            console.error(`OpenAI error for ${dish.name}:`, error);
        }
    }
    return map;
}

/**
 * Check if user can scan based on your existing schema
 */
async function checkUserScanPermission(userId, sessionId) {
    try {
        if (userId) {
            // Use your existing user_scan_limits view
            const { data: userLimits, error } = await supabase
                .from('user_scan_limits')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('User lookup error:', error);
                return { canScan: true, isAnonymous: true };
            }

            return { 
                canScan: userLimits.can_scan, 
                user: userLimits,
                scansRemaining: userLimits.scans_remaining 
            };
            
        } else if (sessionId) {
            // Check anonymous session limits using your user_sessions table
            const { data: session, error } = await supabase
                .from('user_sessions')
                .select('free_scans_used')
                .eq('session_id', sessionId)
                .single();

            if (error || !session) {
                // Create new session
                const { data: newSession } = await supabase
                    .from('user_sessions')
                    .insert([{
                        session_id: sessionId,
                        free_scans_used: 0,
                        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                    }])
                    .select()
                    .single();

                return { canScan: true, isAnonymous: true, session: newSession };
            }

            const canScan = session.free_scans_used < 5; // Free limit
            return { canScan, isAnonymous: true, session };
        }

        return { canScan: true, isAnonymous: true };
        
    } catch (error) {
        console.error('Permission check error:', error);
        return { canScan: true, isAnonymous: true };
    }
}

/**
 * Main function handler
 */
exports.handler = async (event, context) => {
    const startTime = Date.now();
    
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
        const { 
            image, 
            targetLanguage = 'en',
            userId = null,
            sessionId = null,
            userFingerprint = null
        } = JSON.parse(event.body || '{}');

        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        // Permission check
        const permission = await checkUserScanPermission(userId, sessionId);
        if (!permission.canScan) {
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Scan limit reached. Please upgrade to continue.',
                    scansRemaining: permission.scansRemaining || 0
                })
            };
        }

        // 1. OCR: Extract text from image
        const visionResult = await extractTextFromImage(image);
        if (!visionResult.fullText || visionResult.fullText.trim().length < 10) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No readable text found in image. Please try a clearer photo.' 
                })
            };
        }

        // 2. Parse menu text into sections/dishes
        const parsedSections = parseMenuText(visionResult.fullText);
        
        // 3. Flatten all dishes for lookup
        const allDishes = [];
        parsedSections.forEach(section => {
            section.dishes.forEach(dish => allDishes.push(dish));
        });

        // 4. Lookup dishes in Supabase
        const dbExplanations = await lookupDishesInSupabase(allDishes, targetLanguage);

        // 5. For missing dishes, use OpenAI and save to Supabase
        const missingDishes = allDishes.filter(dish => !dbExplanations[dish.name]);
        let aiExplanations = {};
        if (missingDishes.length > 0) {
            aiExplanations = await fetchAndSaveExplanationsFromOpenAI(missingDishes, targetLanguage);
        }

        // 6. Attach explanations to dishes
        parsedSections.forEach(section => {
            section.dishes.forEach(dish => {
                dish.explanation = dbExplanations[dish.name] || aiExplanations[dish.name] || '';
            });
        });

        // 7. Save scan to DB (optional, you can keep your existing logic)
        // (You may want to update this to use the new structure if needed)

        // 8. Return results
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: parsedSections,
                    sourceLanguage: visionResult.detectedLanguages || 'unknown',
                    targetLanguage: targetLanguage,
                    processingTime: Date.now() - startTime,
                    dishesFound: allDishes.length
                }
            })
        };

    } catch (error) {
        console.error('❌ Detailed error:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error message:', error.message);
        
        const processingTime = Date.now() - startTime;
        let errorMessage = 'Menu processing failed. Please try again.';
        let statusCode = 500;

        if (error.message && error.message.includes('No text detected')) {
            errorMessage = 'No text found in image. Please try a clearer photo.';
            statusCode = 400;
        } else if (error.message && (error.message.includes('quota') || error.message.includes('rate limit'))) {
            errorMessage = 'Service temporarily busy. Please try again in a moment.';
            statusCode = 503;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                success: false,
                error: errorMessage,
                processingTime,
                timestamp: new Date().toISOString(),
                debugInfo: error.message
            })
        };
    }
};