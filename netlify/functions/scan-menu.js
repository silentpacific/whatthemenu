exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { image } = JSON.parse(event.body);
        
        // Call OpenAI with better prompt
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "user",
                    content: [{
                        type: "text",
                        text: "Analyze this menu image carefully. Extract ALL visible dishes and organize them by sections (like Appetizers, Mains, Desserts, etc.). For each dish, provide the EXACT name from the menu and original description if visible. Return ONLY valid JSON in this format: {\"sections\":[{\"name\":\"Section Name\",\"emoji\":\"🍽️\",\"dishes\":[{\"name\":\"Exact Dish Name from Menu\",\"originalDescription\":\"Exact description from menu or empty string if none\",\"aiExplanation\":\"Your helpful explanation in 200 characters or less\",\"hasWarnings\":false,\"isSpicy\":false}]}]}"
                    }, {
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${image}` }
                    }]
                }],
                max_tokens: 1500
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`OpenAI error: ${data.error?.message || 'Unknown error'}`);
        }

        let content = data.choices[0].message.content;
        
        // Clean up response
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        const parsedContent = JSON.parse(content);
        
        // Save to Supabase
        await saveToDatabase(parsedContent, image.substring(0, 100)); // Save first 100 chars of image as identifier
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: parsedContent
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

// Function to save to Supabase
async function saveToDatabase(menuData, imageIdentifier) {
    try {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Save each dish to cache for future lookups
        for (const section of menuData.sections) {
            for (const dish of section.dishes) {
                await supabase
                    .from('menu_cache')
                    .upsert({
                        dish_name: dish.name.toLowerCase().trim(),
                        original_description: dish.originalDescription,
                        ai_explanation: dish.aiExplanation,
                        has_warnings: dish.hasWarnings || false,
                        is_spicy: dish.isSpicy || false,
                        section_name: section.name,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'dish_name'
                    });
            }
        }

        // Save scan session
        await supabase
            .from('scan_sessions')
            .insert({
                image_identifier: imageIdentifier,
                menu_data: menuData,
                created_at: new Date().toISOString()
            });

        console.log('Saved to database successfully');
        
    } catch (error) {
        console.error('Database save error:', error);
        // Don't throw error - let the response succeed even if DB save fails
    }
}