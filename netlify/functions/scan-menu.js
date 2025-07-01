// netlify/functions/scan-menu.js - Updated for your existing schema

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
 * Extract text from image using Google Cloud Vision
 */
async function extractTextFromImage(base64Image) {
    try {
        console.log('🔍 Starting Google Cloud Vision text extraction...');
        
        const [result] = await visionClient.textDetection({
            image: {
                content: base64Image,
            },
            imageContext: {
                languageHints: ['en', 'es', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'th', 'vi'],
            },
        });

        const detections = result.textAnnotations;
        
        if (!detections || detections.length === 0) {
            throw new Error('No text detected in image');
        }

        const extractedText = detections[0].description;
        console.log(`✅ Extracted ${extractedText.length} characters of text`);
        
        return {
            fullText: extractedText,
            detectedLanguages: result.textAnnotations[0]?.locale || 'unknown'
        };
        
    } catch (error) {
        console.error('❌ Google Vision API error:', error);
        throw new Error(`Text extraction failed: ${error.message}`);
    }
}

/**
 * Process extracted text with OpenAI GPT-4o
 */
async function processMenuWithAI(extractedText, targetLanguage = 'en') {
    try {
        console.log('🤖 Starting OpenAI GPT-4o processing...');
        
        const prompt = `You are a helpful restaurant menu translator and explainer. 

EXTRACTED MENU TEXT:
${extractedText}

Please analyze this menu text and return a JSON response with the following structure:

{
  "sections": [
    {
      "name": "Section Name (e.g., Appetizers, Main Courses, Desserts)",
      "emoji": "Appropriate emoji for section",
      "dishes": [
        {
          "name": "Dish name in ${targetLanguage === 'en' ? 'English' : 'target language'}",
          "originalDescription": "Original description from menu (if any)",
          "aiExplanation": "Brief, friendly explanation of what this dish is, ingredients, cooking method, dietary notes if relevant. Keep it conversational and helpful for someone unfamiliar with the cuisine.",
          "isSpicy": boolean,
          "isVegetarian": boolean,
          "isVegan": boolean,
          "allergens": ["list", "of", "common", "allergens"],
          "cuisineType": "cuisine category like Italian, Japanese, etc."
        }
      ]
    }
  ],
  "sourceLanguage": "detected language code",
  "confidence": 0.9,
  "warnings": ["Any warnings about spicy food, allergens, etc."]
}

Rules:
1. Group similar dishes into logical sections
2. If no clear sections exist, use "Main Dishes" 
3. Keep explanations under 100 words per dish
4. Translate dish names to ${targetLanguage === 'en' ? 'English' : targetLanguage} but keep original in originalDescription
5. Be helpful about ingredients and preparation methods
6. Flag spicy dishes and common allergens
7. If text is unclear or not a menu, set confidence below 0.5

Return ONLY valid JSON, no other text.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an expert restaurant menu translator and food explainer. Always respond with valid JSON only."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 3000,
            temperature: 0.3,
        });

        const response = completion.choices[0]?.message?.content?.trim();
        
        if (!response) {
            throw new Error('Empty response from OpenAI');
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(response);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            throw new Error('Invalid JSON response from AI');
        }

        if (!parsedResponse.sections || !Array.isArray(parsedResponse.sections)) {
            throw new Error('Invalid response structure from AI');
        }

        console.log(`✅ Successfully processed ${parsedResponse.sections.length} menu sections`);
        return parsedResponse;
        
    } catch (error) {
        console.error('❌ OpenAI processing error:', error);
        throw new Error(`AI processing failed: ${error.message}`);
    }
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
 * Save scan to your existing tables
 */
async function saveScanToDatabase(scanData) {
    try {
        // Save to menu_scans table
        const { data: scan, error: scanError } = await supabase
            .from('menu_scans')
            .insert([{
                user_id: scanData.user_id,
                session_id: scanData.session_id,
                user_fingerprint: scanData.user_fingerprint,
                original_text: scanData.original_text,
                translated_sections: scanData.translated_sections,
                source_language: scanData.source_language,
                target_language: scanData.target_language,
                processing_time_ms: scanData.processing_time_ms,
                processing_status: 'completed',
                total_dishes_found: scanData.dishes_count,
                scan_type: 'ai_translation'
            }])
            .select()
            .single();

        if (scanError) {
            console.error('Scan save error:', scanError);
        }

        // Save individual dishes to dishes table
        if (scan && scanData.translated_sections) {
            const dishesData = [];
            scanData.translated_sections.forEach((section, sectionIndex) => {
                section.dishes.forEach((dish, dishIndex) => {
                    dishesData.push({
                        menu_scan_id: scan.id,
                        name: dish.name,
                        explanation: dish.aiExplanation,
                        language: scanData.target_language,
                        cuisine_type: dish.cuisineType || section.name,
                        dietary_tags: [
                            ...(dish.isVegetarian ? ['vegetarian'] : []),
                            ...(dish.isVegan ? ['vegan'] : []),
                            ...(dish.isSpicy ? ['spicy'] : []),
                            ...(dish.allergens || [])
                        ],
                        confidence_score: 0.9,
                        position_in_menu: sectionIndex * 100 + dishIndex
                    });
                });
            });

            if (dishesData.length > 0) {
                await supabase.from('dishes').insert(dishesData);
            }
        }

        // Update user scan count if authenticated
        if (scanData.user_id) {
            await supabase
                .from('users')
                .update({ 
                    free_scans_used: supabase.sql`free_scans_used + 1`,
                    updated_at: new Date().toISOString()
                })
                .eq('id', scanData.user_id);
        } else if (scanData.session_id) {
            // Update session scan count
            await supabase
                .from('user_sessions')
                .update({ 
                    free_scans_used: supabase.sql`free_scans_used + 1`,
                    last_activity_at: new Date().toISOString()
                })
                .eq('session_id', scanData.session_id);
        }

        return scan;
    } catch (error) {
        console.error('Save scan error:', error);
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

        console.log(`🚀 Starting menu scan for ${userId ? 'user ' + userId : 'session ' + sessionId}`);

        // Check permissions using your schema
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

        // Extract text from image
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

        // Process with AI
        const aiResult = await processMenuWithAI(visionResult.fullText, targetLanguage);
        
        if (aiResult.confidence < 0.5) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Image does not appear to contain a readable menu. Please try a different photo.' 
                })
            };
        }

        // Count total dishes for tracking
        const dishesCount = aiResult.sections.reduce((total, section) => total + section.dishes.length, 0);

        // Save scan to database
        const scanData = {
            user_id: userId,
            session_id: sessionId,
            user_fingerprint: userFingerprint,
            original_text: visionResult.fullText,
            translated_sections: aiResult.sections,
            source_language: aiResult.sourceLanguage,
            target_language: targetLanguage,
            processing_time_ms: Date.now() - startTime,
            dishes_count: dishesCount
        };
        
        saveScanToDatabase(scanData); // Don't await

        console.log(`✅ Menu scan completed in ${Date.now() - startTime}ms`);

        // Return success response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: aiResult.sections,
                    sourceLanguage: aiResult.sourceLanguage,
                    targetLanguage: targetLanguage,
                    confidence: aiResult.confidence,
                    warnings: aiResult.warnings || [],
                    processingTime: Date.now() - startTime,
                    dishesFound: dishesCount
                }
            })
        };

    } catch (error) {
        console.error('❌ Scan function error:', error);
        
        const processingTime = Date.now() - startTime;
        
        let errorMessage = 'Menu processing failed. Please try again.';
        let statusCode = 500;

        if (error.message.includes('No text detected')) {
            errorMessage = 'No text found in image. Please try a clearer photo.';
            statusCode = 400;
        } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
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
                timestamp: new Date().toISOString()
            })
        };
    }
};