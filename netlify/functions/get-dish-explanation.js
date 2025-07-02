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

// Helper: Count explanations for this scan (for free tier limit)
async function getScanExplanationCount(scanId) {
    const { count, error } = await supabase
        .from('dishes')
        .select('*', { count: 'exact', head: true })
        .eq('scan_id', scanId);
    if (error) {
        console.error('Supabase explanation count error:', error);
        return 0;
    }
    return count || 0;
}

exports.handler = async (event, context) => {
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
        const { name, description = '', userId, scanId, language = 'en' } = JSON.parse(event.body || '{}');
        if (!name || !userId || !scanId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing required fields' })
            };
        }

        // 1. Get user tier
        const userTier = await getUserTier(userId);
        console.log(`User ${userId} has tier: ${userTier}`);

        // 2. Enforce explanation limits
        if (userTier === 'free') {
            const explanationCount = await getScanExplanationCount(scanId);
            if (explanationCount >= 5) {
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Free tier allows only 5 explanations per scan. Please upgrade to continue.',
                        explanationsRemaining: 0
                    })
                };
            }
        }

        // 3. Check Supabase for existing explanation
        const { data, error } = await supabase
            .from('dishes')
            .select('explanation')
            .eq('name', name)
            .eq('scan_id', scanId)
            .eq('language', language)
            .maybeSingle();

        if (error) {
            console.error('Supabase lookup error:', error);
        }

        if (data && data.explanation) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, explanation: data.explanation, source: 'db' })
            };
        }

        // 4. If not found, query OpenAI
        const prompt = `Explain the following dish for a menu in a friendly, concise way (max 60 words). Include dietary notes if available.\n\nDish: ${name}\nDescription: ${description}`;
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

        // 5. Save to Supabase
        await supabase.from('dishes').insert([
            {
                name,
                explanation,
                language,
                scan_id: scanId,
                user_id: userId,
                created_at: new Date().toISOString()
            }
        ]);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, explanation, source: 'openai' })
        };

    } catch (error) {
        console.error('❌ Error in get-dish-explanation:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};