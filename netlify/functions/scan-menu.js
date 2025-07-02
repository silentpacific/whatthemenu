const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

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
    if (error) {
        console.error('Supabase scan count error:', error);
        return 0;
    }
    return count || 0;
}

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
        const { image, userId } = JSON.parse(event.body || '{}');
        if (!image || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image or user ID provided' })
            };
        }

        // 1. Get user tier
        const userTier = await getUserTier(userId);
        console.log(`User ${userId} has tier: ${userTier}`);

        // 2. Enforce scan limits
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

        // 3. Use OpenAI Vision to extract and parse menu
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that extracts structured menu data from images. Always respond with valid JSON only."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: `Extract all menu sections, dish names, prices, and descriptions from this menu image. Return as a JSON array of sections, each with a name and an array of dishes (each dish has name, price, description). Example format: [{"section":"Starters","dishes":[{"name":"Garlic Bread","price":"$5.9","description":"2 slices of sourdough bread, confit garlic, fresh herbs"}]}]` },
                        { type: "image_url", image_url: { "url": `data:image/png;base64,${base64Image}` } }
                    ]
                }
            ],
            max_tokens: 2000,
            temperature: 0.2
        });

        const responseText = visionResponse.choices[0]?.message?.content?.trim();
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

        // 4. Store scan in Supabase
        const { error: scanError } = await supabase.from('menu_scans').insert([
            {
                user_id: userId,
                tier: userTier,
                menu_json: parsedSections,
                created_at: new Date().toISOString()
            }
        ]);
        if (scanError) {
            console.error('Supabase scan insert error:', scanError);
        }

        // 5. Return structured menu
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: parsedSections,
                    userTier,
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