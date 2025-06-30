const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { image, targetLanguage } = JSON.parse(event.body);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this menu image and organize the dishes by sections (like Appetizers, Main Courses, etc.). Return JSON with this exact structure: {\"sections\":[{\"name\":\"Appetizers\",\"emoji\":\"🥗\",\"dishes\":[{\"name\":\"Dish Name\",\"originalDescription\":\"Original text from menu\",\"aiExplanation\":\"User-friendly explanation up to 300 characters\",\"hasWarnings\":false,\"allergens\":[],\"isSpicy\":false}]}]}"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            })
        });

        const data = await response.json();
        let content = data.choices[0].message.content;

        // Clean up the content if it has markdown formatting
        if (content.includes('```json')) {
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        }

        const parsedContent = JSON.parse(content);
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: true,
                data: parsedContent
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};