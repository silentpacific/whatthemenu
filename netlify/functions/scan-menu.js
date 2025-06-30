exports.handler = async (event, context) => {
    // Handle CORS
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
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { image } = JSON.parse(event.body);
        
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
                        text: "Return JSON: {\"sections\":[{\"name\":\"Appetizers\",\"emoji\":\"🥗\",\"dishes\":[{\"name\":\"Dish Name\",\"originalDescription\":\"menu text\",\"aiExplanation\":\"brief explanation\"}]}]}"
                    }, {
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${image}` }
                    }]
                }],
                max_tokens: 500
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content;
        
        if (content.includes('```')) {
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: JSON.parse(content)
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Processing failed'
            })
        };
    }
};