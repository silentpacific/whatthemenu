exports.handler = async (event, context) => {
    try {
        const { createClient } = require('@supabase/supabase-js');
        
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Test insert
        const { data, error } = await supabase
            .from('menu_cache')
            .insert({
                dish_name: 'test_dish_' + Date.now(),
                original_description: 'Test description',
                ai_explanation: 'Test explanation',
                section_name: 'Test Section'
            });

        if (error) throw error;

        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                success: true, 
                message: 'Database connection works!',
                data: data 
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};