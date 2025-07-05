exports.handler = async (event, context) => {
    console.log('Minimal scan function started');
    
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
        
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        // Return sample data for testing
        const sampleSections = [{
            section: 'Menu Items',
            dishes: [
                { name: 'Margherita Pizza', description: 'No description available' },
                { name: 'Pepperoni Pizza', description: 'No description available' },
                { name: 'Caesar Salad', description: 'No description available' },
                { name: 'Garlic Bread', description: 'No description available' },
                { name: 'Tiramisu', description: 'No description available' }
            ]
        }];

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    sections: sampleSections,
                    userTier: 'free',
                    userId: userId || '',
                    scanId: 'temp_' + Date.now(),
                    processingTime: Date.now(),
                    rawText: 'Sample menu text',
                    confidence: 50,
                    source: 'minimal-test',
                    totalDishes: sampleSections[0].dishes.length,
                    totalSections: 1
                }
            })
        };

    } catch (error) {
        console.error('Function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false,
                error: 'Failed to process menu image: ' + error.message
            })
        };
    }
}; 