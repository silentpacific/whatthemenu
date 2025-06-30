const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    console.log('=== scan-menu function started ===');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return { statusCode: 200, headers };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ success: false, error: 'Method not allowed' }) 
        };
    }

    try {
        console.log('Parsing request body...');
        const { image, targetLanguage = 'en' } = JSON.parse(event.body || '{}');
        
        // Validate inputs
        if (!image) {
            console.error('No image provided in request');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        // Check API key
        if (!process.env.OPENAI_API_KEY) {
            console.error('OpenAI API key not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'OpenAI API key not configured' })
            };
        }

        // Optimize image size before sending
        const optimizedImage = await optimizeImageSize(image);
        
        const startTime = Date.now();
        console.log('Starting OpenAI API call...');
        
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
                        text: `Analyze this menu image and organize dishes by sections. Return ONLY valid JSON in this exact format:
{
  "sections": [
    {
      "name": "Section Name",
      "emoji": "🍽️",
      "dishes": [
        {
          "name": "Dish Name",
          "originalDescription": "Original text from menu",
          "aiExplanation": "Brief explanation in ${targetLanguage}",
          "hasWarnings": false
        }
      ]
    }
  ]
}

Important: Return ONLY the JSON object, no markdown formatting, no additional text.`
                    }, {
                        type: "image_url",
                        image_url: { 
                            url: `data:image/jpeg;base64,${optimizedImage}`,
                            detail: "low"
                        }
                    }]
                }],
                max_tokens: 1500,
                temperature: 0.1
            })
        });

        const duration = Date.now() - startTime;
        console.log(`OpenAI API call completed in ${duration}ms with status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
            
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: `OpenAI API error: ${response.status}` 
                })
            };
        }

        console.log('Parsing OpenAI response...');
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('Invalid OpenAI response structure');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'Invalid OpenAI response' })
            };
        }

        let content = data.choices[0].message.content;
        console.log('Raw OpenAI response preview:', content.substring(0, 200));

        // Clean up the content - remove markdown formatting
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        // Try to extract JSON if there's extra text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            content = jsonMatch[0];
        }

        console.log('Cleaned content preview:', content.substring(0, 200));

        // Parse the JSON
        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
        } catch (parseError) {
            console.error('JSON parsing failed:', parseError);
            console.error('Content that failed to parse:', content);
            
            // Return a fallback response
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    data: {
                        sections: [{
                            name: "Menu Items",
                            emoji: "🍽️",
                            dishes: [{
                                name: "Unable to parse menu",
                                originalDescription: "The AI could not parse this menu properly",
                                aiExplanation: "Please try a clearer image or different angle",
                                hasWarnings: true
                            }]
                        }]
                    }
                })
            };
        }

        // Validate the parsed content structure
        if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
            console.error('Invalid sections structure in parsed content');
            parsedContent = {
                sections: [{
                    name: "Menu Items",
                    emoji: "🍽️",
                    dishes: [{
                        name: "Parsing Error",
                        originalDescription: "Could not organize menu properly",
                        aiExplanation: "The menu structure was not recognized correctly",
                        hasWarnings: true
                    }]
                }]
            };
        }
        
        console.log(`Total processing time: ${Date.now() - startTime}ms`);
        console.log('Successfully processed menu with', parsedContent.sections.length, 'sections');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: parsedContent })
        };

    } catch (error) {
        console.error('Function error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: `Processing failed: ${error.message}` 
            })
        };
    }
};

// Optimize image size for faster processing
async function optimizeImageSize(base64Image) {
    try {
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const imageSizeKB = Math.round(imageBuffer.length / 1024);
        
        console.log(`Image size: ${imageSizeKB}KB`);
        
        // If image is larger than 1MB, log it but still process
        if (imageBuffer.length > 1024 * 1024) {
            console.log('Large image detected (>1MB), processing with low detail');
        }
        
        // For now, return as-is but we could add actual compression here
        return base64Image;
        
    } catch (error) {
        console.warn('Image optimization failed, using original:', error.message);
        return base64Image;
    }
}