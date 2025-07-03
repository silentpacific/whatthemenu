const { createClient } = require('@supabase/supabase-js');

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
        // Sample dish data
        const sampleDishes = [
            {
                name: 'Pizza Margherita',
                explanation: 'Classic Italian pizza with tomato sauce, mozzarella cheese, and fresh basil. A simple yet delicious combination of flavors.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Spaghetti Carbonara',
                explanation: 'Traditional Roman pasta dish with eggs, cheese, pancetta, and black pepper. Rich and creamy without using cream.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Caesar Salad',
                explanation: 'Fresh romaine lettuce with Caesar dressing, croutons, and parmesan cheese. A classic American salad with Italian roots.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Chicken Tikka Masala',
                explanation: 'Tender chicken in a creamy, spiced tomato sauce. A popular Indian dish that\'s mild and flavorful.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Beef Burger',
                explanation: 'Juicy beef patty served on a bun with lettuce, tomato, and cheese. A classic American comfort food.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Sushi Roll',
                explanation: 'Fresh fish and vegetables wrapped in rice and seaweed. A healthy and delicious Japanese dish.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Pad Thai',
                explanation: 'Stir-fried rice noodles with eggs, tofu, and peanuts. A popular Thai street food dish.',
                language: 'en',
                created_at: new Date().toISOString()
            },
            {
                name: 'Fish and Chips',
                explanation: 'Crispy battered fish served with golden fries. A British pub classic.',
                language: 'en',
                created_at: new Date().toISOString()
            }
        ];

        // Insert sample dishes
        const { data, error } = await supabase
            .from('dishes')
            .insert(sampleDishes)
            .select();

        if (error) {
            console.error('Error inserting dishes:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: error.message
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Sample dishes added successfully',
                data: {
                    insertedDishes: data,
                    count: data.length
                }
            })
        };

    } catch (error) {
        console.error('Error:', error);
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