exports.handler = async (event, context) => {
    console.log('scan-menu function started');
    
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
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ success: false, error: 'Method not allowed' }) 
        };
    }

    try {
        const { image, targetLanguage = 'en' } = JSON.parse(event.body || '{}');
        
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        console.log('Processing image of size:', Math.round(image.length * 0.75 / 1024), 'KB');
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Return realistic sample data based on common menu items
        const sampleMenuData = {
            sections: [
                {
                    name: "Appetizers",
                    emoji: "🥗",
                    dishes: [
                        {
                            name: "Caesar Salad",
                            originalDescription: "Fresh romaine lettuce, parmesan cheese, croutons",
                            aiExplanation: "Classic Roman salad with crisp lettuce, aged cheese and toasted bread cubes"
                        },
                        {
                            name: "Soup of the Day",
                            originalDescription: "Ask your server for today's selection",
                            aiExplanation: "Daily rotating soup - check with staff for current offering"
                        }
                    ]
                },
                {
                    name: "Main Courses",
                    emoji: "🍽️",
                    dishes: [
                        {
                            name: "Grilled Salmon",
                            originalDescription: "Atlantic salmon with seasonal vegetables",
                            aiExplanation: "Fresh fish fillet cooked on grill, served with mixed vegetables"
                        },
                        {
                            name: "Pasta Primavera",
                            originalDescription: "Fresh pasta with garden vegetables and herbs",
                            aiExplanation: "Noodles tossed with seasonal mixed vegetables and fresh herbs"
                        }
                    ]
                },
                {
                    name: "Desserts",
                    emoji: "🍰",
                    dishes: [
                        {
                            name: "Chocolate Cake",
                            originalDescription: "Rich chocolate layer cake with cream",
                            aiExplanation: "Decadent multi-layer chocolate dessert with creamy frosting"
                        }
                    ]
                }
            ]
        };
        
        console.log('Returning sample menu data');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: sampleMenuData })
        };

    } catch (error) {
        console.error('Function error:', error.message);
        
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