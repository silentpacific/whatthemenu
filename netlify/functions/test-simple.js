exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            message: 'Test function is working!',
            timestamp: new Date().toISOString(),
            method: event.httpMethod
        })
    };
}; 