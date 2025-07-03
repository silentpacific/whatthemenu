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

    try {
        // Test 1: Check if dishes table has data
        const { data: dishesData, error: dishesError } = await supabase
            .from('dishes')
            .select('name, explanation')
            .limit(5);

        if (dishesError) {
            console.error('Error querying dishes table:', dishesError);
        }

        // Test 2: Simulate the new flow with sample dish names
        const sampleDishNames = ['Pizza Margherita', 'Spaghetti Carbonara', 'Caesar Salad'];
        const enrichedDishes = [];

        for (const dishName of sampleDishNames) {
            const { data: dishData, error: dishError } = await supabase
                .from('dishes')
                .select('explanation')
                .eq('name', dishName)
                .maybeSingle();
            
            if (dishError) {
                console.error('Supabase dish lookup error:', dishError);
            }
            
            enrichedDishes.push({
                name: dishName,
                description: dishData?.explanation || 'No description available'
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Test completed successfully',
                data: {
                    existingDishes: dishesData || [],
                    enrichedDishes: enrichedDishes,
                    totalDishesInTable: dishesData?.length || 0
                }
            })
        };

    } catch (error) {
        console.error('Test error:', error);
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