const fetch = require('node-fetch');

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
        console.log('Parsing request...');
        
        let requestBody;
        try {
            requestBody = JSON.parse(event.body || '{}');
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid JSON' })
            };
        }
        
        const { image, targetLanguage = 'en' } = requestBody;
        
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        if (!process.env.OPENAI_API_KEY) {
            console.error('Missing OpenAI API key');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'API key not configured' })
            };
        }

        console.log('Image size:', Math.round(image.length * 0.75 / 1024), 'KB');
        console.log('Calling OpenAI...');
        
        const startTime = Date.now();
        
        const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Extract menu items and return JSON: {\"sections\":[{\"name\":\"Appetizers\",\"emoji\":\"🥗\",\"dishes\":[{\"name\":\"Dish Name\",\"originalDescription\":\"menu text\",\"aiExplanation\":\"simple explanation\"}]}]}"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`,
                                    detail: "low"
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
                temperature: 0.1
            })
        });

        const duration = Date.now() - startTime;
        console.log(`OpenAI responded in ${duration}ms with status:`, openAIResponse.status);

        if (!openAIResponse.ok) {
            const errorText = await openAIResponse.text();
            console.error('OpenAI error:', openAIResponse.status, errorText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: `OpenAI error: ${openAIResponse.status}` })
            };
        }

        const openAIData = await openAIResponse.json();
        let content = openAIData.choices[0].message.content;
        
        console.log('Raw response:', content.substring(0, 100));
        
        // Clean JSON
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
        } catch (jsonError) {
            console.error('JSON parse failed:', jsonError);
            parsedContent = {
                sections: [{
                    name: "Menu Items",
                    emoji: "🍽️",
                    dishes: [{
                        name: "Could not parse menu",
                        originalDescription: "Processing error occurred",
                        aiExplanation: "Please try a different image"
                    }]
                }]
            };
        }

        // Validate structure
        if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
            parsedContent = {
                sections: [{
                    name: "Menu Items",
                    emoji: "🍽️", 
                    dishes: [{
                        name: "Invalid response",
                        originalDescription: "Could not understand menu format",
                        aiExplanation: "Try a clearer photo"
                    }]
                }]
            };
        }

        console.log(`Success! Total time: ${Date.now() - startTime}ms`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: parsedContent })
        };

    } catch (error) {
        console.error('Function error:', error.name, error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Processing failed: ' + error.message
            })
        };
    }
};