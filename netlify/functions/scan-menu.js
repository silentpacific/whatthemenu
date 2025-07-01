const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    console.log('=== scan-menu function started ===');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        console.log('OPTIONS request handled');
        return { statusCode: 200, headers };
    }

    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ success: false, error: 'Method not allowed' }) 
        };
    }

    try {
        console.log('=== Parsing request ===');
        
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
            console.error('No image provided');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        console.log('=== Checking OpenAI API key ===');
        if (!process.env.OPENAI_API_KEY) {
            console.error('Missing OpenAI API key');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'API key not configured' })
            };
        }
        
        console.log('OpenAI API key found:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');

        console.log('Image size:', Math.round(image.length * 0.75 / 1024), 'KB');
        console.log('=== Calling OpenAI API ===');
        
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
                max_tokens: 800,
                temperature: 0.1
            })
        });

        const duration = Date.now() - startTime;
        console.log(`=== OpenAI API Response ===`);
        console.log(`Response time: ${duration}ms`);
        console.log(`Status: ${openAIResponse.status}`);
        console.log(`Status Text: ${openAIResponse.statusText}`);

        if (!openAIResponse.ok) {
            const errorText = await openAIResponse.text();
            console.error('=== OpenAI API Error ===');
            console.error('Status:', openAIResponse.status);
            console.error('Error:', errorText);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: `OpenAI error: ${openAIResponse.status} - ${errorText}` })
            };
        }

        console.log('=== Processing OpenAI Response ===');
        const openAIData = await openAIResponse.json();
        
        if (!openAIData.choices || !openAIData.choices[0] || !openAIData.choices[0].message) {
            console.error('Invalid OpenAI response structure:', JSON.stringify(openAIData, null, 2));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid OpenAI response structure' })
            };
        }
        
        let content = openAIData.choices[0].message.content;
        console.log('=== Raw OpenAI Content ===');
        console.log('Full content:', content);
        
        // Clean JSON
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log('=== Cleaned Content ===');
        console.log('Cleaned:', content);
        
        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
            console.log('=== Successfully Parsed JSON ===');
            console.log('Parsed structure:', JSON.stringify(parsedContent, null, 2));
        } catch (jsonError) {
            console.error('=== JSON Parse Failed ===');
            console.error('Parse error:', jsonError.message);
            console.error('Content that failed:', content);
            
            // Return fallback
            parsedContent = {
                sections: [{
                    name: "Menu Items",
                    emoji: "🍽️",
                    dishes: [{
                        name: "JSON Parse Error",
                        originalDescription: "Could not parse OpenAI response",
                        aiExplanation: `Parse error: ${jsonError.message}`
                    }]
                }]
            };
        }

        // Validate structure
        if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
            console.error('=== Invalid Structure ===');
            console.error('Missing or invalid sections:', parsedContent);
            
            parsedContent = {
                sections: [{
                    name: "Menu Items",
                    emoji: "🍽️", 
                    dishes: [{
                        name: "Structure Error",
                        originalDescription: "Response structure was invalid",
                        aiExplanation: "OpenAI returned unexpected format"
                    }]
                }]
            };
        }

        console.log(`=== Success! Total time: ${Date.now() - startTime}ms ===`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: parsedContent })
        };

    } catch (error) {
        console.error('=== Function Error ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
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