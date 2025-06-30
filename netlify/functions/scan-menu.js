const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    console.log('Function started');
    
    // Handle CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Parsing request body...');
        const { image, targetLanguage } = JSON.parse(event.body);
        
        console.log('Checking API key...');
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not found');
        }
        
        console.log('Making OpenAI API call...');
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
                                text: "Analyze this menu image and organize the dishes by sections. Return JSON: {\"sections\":[{\"name\":\"Appetizers\",\"emoji\":\"🥗\",\"dishes\":[{\"name\":\"Dish Name\",\"originalDescription\":\"text from menu\",\"aiExplanation\":\"explanation up to 300 chars\",\"hasWarnings\":false}]}]}"
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

        console.log('OpenAI response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('OpenAI error:', errorText);
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        console.log('Parsing OpenAI response...');
        const data = await response.json();
        let content = data.choices[0].message.content;

        console.log('Raw content:', content.substring(0, 200));

        // Clean up the content if it has markdown formatting
        if (content.includes('```json')) {
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        }

        console.log('Parsing JSON...');
        const parsedContent = JSON.parse(content);
        
        console.log('Success! Returning data...');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: parsedContent
            })
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