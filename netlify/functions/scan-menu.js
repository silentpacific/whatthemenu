const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: Get user tier from user_subscriptions table
async function getUserTier(userId) {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_type')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('Supabase user_subscriptions lookup error:', error);
        return 'free'; // fallback to free
    }
    return data && data.subscription_type ? data.subscription_type : 'free';
}

// Helper: Count scans for user (for free tier limit)
async function getUserScanCount(userId) {
    const { count, error } = await supabase
        .from('menu_scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
    if (error) return 0;
    return count || 0;
}

// Helper: Count scans for session (for anonymous free tier)
async function getSessionScanCount(sessionId) {
    const { count, error } = await supabase
        .from('menu_scans')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);
    if (error) return 0;
    return count || 0;
}

exports.handler = async (event, context) => {
    const startTime = Date.now();
    console.log('Function started');
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
        if (!image || (!userId && !sessionId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image or session/user ID provided' })
            };
        }

        // 1. Determine tier and enforce scan limits
        let userTier = 'free';
        if (userId) {
            userTier = await getUserTier(userId);
            if (userTier === 'free') {
                const scanCount = await getUserScanCount(userId);
                if (scanCount >= 5) {
                    return {
                        statusCode: 429,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            error: 'Free tier scan limit reached. Please upgrade to continue.',
                            scansRemaining: 0
                        })
                    };
                }
            }
        } else {
            // Anonymous user (sessionId)
            const scanCount = await getSessionScanCount(sessionId);
            if (scanCount >= 5) {
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Free tier scan limit reached. Please create an account or upgrade to continue.',
                        scansRemaining: 0
                    })
                };
            }
        }

        // 2. Use OpenAI Vision to extract and parse menu
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        // Resize image to max 1024px width, JPEG 70% quality
        const resizedBuffer = await sharp(Buffer.from(base64Image, 'base64'))
            .resize(1024, null, { withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
        const resizedBase64 = resizedBuffer.toString('base64');
        // Before OpenAI call
        console.log('About to call OpenAI:', Date.now() - startTime, 'ms');
        const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that extracts only dish names from menu images. Always respond with valid JSON only."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: `Extract ONLY dish names from this menu image. Do not include descriptions, prices, or any other information. Return as a JSON array of sections, each with a name and an array of dishes (each dish has only a name). Example format: [{\"section\":\"Starters\",\"dishes\":[{\"name\":\"Garlic Bread\"},{\"name\":\"Bruschetta\"}]}]` },
                        { type: "image_url", image_url: { "url": `data:image/jpeg;base64,${resizedBase64}`, detail: "low" } }
                    ]
                }
            ],
            max_tokens: 2000,
            temperature: 0.2
        });
        console.log('OpenAI response received:', Date.now() - startTime, 'ms');

        const responseText = visionResponse.choices[0]?.message?.content?.trim();
        console.log("OpenAI raw response:", responseText);
        let parsedSections;
        try {
            parsedSections = JSON.parse(responseText);
        } catch (err) {
            console.error('OpenAI JSON parse error:', err, responseText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Failed to parse menu from OpenAI response.' })
            };
        }

        // 3. Query Supabase dishes table for descriptions
        const enrichedSections = [];
        for (const section of parsedSections) {
            const enrichedSection = { ...section };
            if (section.dishes && section.dishes.length > 0) {
                enrichedSection.dishes = [];
                for (const dish of section.dishes) {
                    // Query Supabase for dish description
                    const { data: dishData, error: dishError } = await supabase
                        .from('dishes')
                        .select('explanation')
                        .eq('name', dish.name)
                        .maybeSingle();
                    
                    if (dishError) {
                        console.error('Supabase dish lookup error:', dishError);
                    }
                    
                    enrichedSection.dishes.push({
                        ...dish,
                        description: dishData?.explanation || 'No description available'
                    });
                }
            }
            enrichedSections.push(enrichedSection);
        }

        // 4. Store scan in Supabase
        const { data: scanInsertData, error: scanError } = await supabase.from('menu_scans').insert([
            {
                user_id: userId || null,
                session_id: sessionId || null,
                tier: userTier,
                menu_json: enrichedSections,
                created_at: new Date().toISOString()
            }
        ]).select().single();

        if (scanError) {
            console.error('Supabase scan insert error:', scanError);
        }

        // 5. Return structured menu with descriptions, userId, scanId
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: enrichedSections,
                    userTier,
                    userId: userId || '',
                    scanId: scanInsertData?.id || '',
                    processingTime: Date.now() - startTime
                }
            })
        };

    } catch (error) {
        console.error('❌ scan-menu error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            })
        };
    }
};