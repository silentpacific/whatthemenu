const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
        const { name, description = '', language = 'en' } = JSON.parse(event.body || '{}');
        console.log('Received request for:', name, '| Description:', description);

        if (!name) {
            console.log('No dish name provided');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No dish name provided' })
            };
        }

        // 1. Check Supabase for existing explanation
        console.log('Checking Supabase...');
        const { data, error } = await supabase
            .from('dishes')
            .select('explanation')
            .eq('name', name)
            .eq('language', language)
            .maybeSingle();

        console.log('Supabase result:', data, '| Error:', error);

        if (error) {
            console.error('Supabase lookup error:', error);
        }

        if (data && data.explanation) {
            console.log('Found explanation in DB, returning.');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, explanation: data.explanation, source: 'db' })
            };
        }

        // 2. If not found, query OpenAI with timeout
        console.log('Querying OpenAI...');
        function timeoutPromise(promise, ms) {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('OpenAI timeout')), ms))
            ]);
        }

        const prompt = `Explain the following dish for a menu in a friendly, concise way (max 60 words). Include dietary notes if available.\n\nDish: ${name}\nDescription: ${description}`;
        let explanation = '';
        try {
            const completion = await timeoutPromise(
                openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'You are a helpful food explainer. Respond with a short, clear explanation.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 200,
                    temperature: 0.4
                }),
                8000 // 8 seconds timeout
            );
            explanation = completion.choices[0]?.message?.content?.trim();
            console.log('OpenAI response:', explanation);
        } catch (err) {
            console.error('OpenAI error or timeout:', err);
            return {
                statusCode: 504,
                headers,
                body: JSON.stringify({ success: false, error: 'OpenAI timeout or error' })
            };
        }

        // 3. Save to Supabase
        console.log('Saving to Supabase...');
        await supabase.from('dishes').insert([
            {
                name,
                explanation,
                language,
                confidence_score: 0.9
            }
        ]);
        console.log('Saved to Supabase. Returning explanation.');

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