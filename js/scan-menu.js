const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    console.log('Function started');
    
    // Set function timeout to 9 seconds (before Netlify's 10s limit)
    const timeoutId = setTimeout(() => {
        console.log('Function timeout reached');
        throw new Error('Function timeout');
    }, 9000);
    
    try {
        // Handle CORS
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Content-Type': 'application/json'
        };

        // Handle preflight requests
        if (event.httpMethod === 'OPTIONS') {
            clearTimeout(timeoutId);
            return { statusCode: 200, headers };
        }

        // Only allow POST requests
        if (event.httpMethod !== 'POST') {
            clearTimeout(timeoutId);
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }

        console.log('Parsing request body...');
        const { image, targetLanguage } = JSON.parse(event.body);
        
        console.log('Checking API key...');
        if (!process.env.OPENAI_API_KEY) {
            clearTimeout(timeoutId);
            throw new Error('OpenAI API key not found');
        }
        
        console.log('Making OpenAI API call with timeout...');
        
        // Create fetch with timeout
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => {
            console.log('OpenAI API call timeout');
            controller.abort();
        }, 8000); // 8 second timeout for API call
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Use faster model to avoid timeout
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this menu image and organize dishes by sections. Return JSON: {\"sections\":[{\"name\":\"Appetizers\",\"emoji\":\"🥗\",\"dishes\":[{\"name\":\"Dish Name\",\"originalDescription\":\"text from menu\",\"aiExplanation\":\"explanation up to 200 chars\",\"hasWarnings\":false}]}]}"
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
                max_tokens: 800 // Reduced to speed up response
            }),
            signal: controller.signal
        });

        clearTimeout(fetchTimeout);
        clearTimeout(timeoutId);

        console.log('OpenAI response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('OpenAI error:', errorText);
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        console.log('Parsing OpenAI response...');
        const data = await response.json();
        let content = data.choices[0].message.content;

        console.log('Raw content preview:', content.substring(0, 100));

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
        clearTimeout(timeoutId);
        console.error('Function error:', error.message);
        
        if (error.name === 'AbortError') {
            console.log('Request was aborted due to timeout');
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Request timeout - please try again'
                })
            };
        }
        
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};