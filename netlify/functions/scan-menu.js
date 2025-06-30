const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Set function timeout to 25 seconds max
    context.callbackWaitsForEmptyEventLoop = false;
    
    console.log('=== scan-menu function started ===');
    
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

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: JSON.stringify({ success: false, error: 'Method not allowed' }) 
        };
    }

    try {
        console.log('Parsing request body...');
        const { image, targetLanguage = 'en' } = JSON.parse(event.body || '{}');
        
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        if (!process.env.OPENAI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, error: 'OpenAI API key not configured' })
            };
        }

        // Compress image if it's too large
        const optimizedImage = await compressImage(image);
        console.log('Optimized image size:', Math.round(optimizedImage.length * 0.75 / 1024), 'KB');
        
        const startTime = Date.now();
        console.log('Starting OpenAI API call...');
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", // Fastest model
                    messages: [{
                        role: "user",
                        content: [{
                            type: "text",
                            text: "Extract menu items as JSON: {\"sections\":[{\"name\":\"Section\",\"emoji\":\"🍽️\",\"dishes\":[{\"name\":\"dish\",\"originalDescription\":\"desc\",\"aiExplanation\":\"brief explanation\"}]}]}"
                        }, {
                            type: "image_url",
                            image_url: { 
                                url: `data:image/jpeg;base64,${optimizedImage}`,
                                detail: "low" // Use low detail for speed
                            }
                        }]
                    }],
                    max_tokens: 800, // Reduced for speed
                    temperature: 0.1
                })
            });

            clearTimeout(timeoutId);
            
            const duration = Date.now() - startTime;
            console.log(`OpenAI responded in ${duration}ms with status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('OpenAI error:', response.status, errorText);
                throw new Error(`OpenAI failed: ${response.status}`);
            }

            const data = await response.json();
            let content = data.choices[0].message.content;
            
            // Clean and parse JSON
            content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            
            // Try to find JSON in the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                content = jsonMatch[0];
            }
            
            let parsedContent;
            try {
                parsedContent = JSON.parse(content);
            } catch (parseError) {
                console.error('JSON parse failed:', parseError);
                // Return fallback data
                parsedContent = {
                    sections: [{
                        name: "Menu Items",
                        emoji: "🍽️",
                        dishes: [{
                            name: "Menu detected",
                            originalDescription: "Could not parse specific items",
                            aiExplanation: "Try a clearer image for better results"
                        }]
                    }]
                };
            }

            // Ensure valid structure
            if (!parsedContent.sections || !Array.isArray(parsedContent.sections)) {
                parsedContent = {
                    sections: [{
                        name: "Menu Items", 
                        emoji: "🍽️",
                        dishes: [{
                            name: "Invalid format",
                            originalDescription: "Menu structure not recognized",
                            aiExplanation: "Please try a different image"
                        }]
                    }]
                };
            }
            
            console.log(`Total time: ${Date.now() - startTime}ms`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: parsedContent })
            };

        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.error('OpenAI request timed out');
                throw new Error('Request timed out - please try again');
            }
            throw fetchError;
        }

    } catch (error) {
        console.error('Function error:', error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message || 'Processing failed'
            })
        };
    }
};

// Compress large images
async function compressImage(base64Image) {
    try {
        const imageBuffer = Buffer.from(base64Image, 'base64');
        const sizeKB = Math.round(imageBuffer.length / 1024);
        
        console.log(`Original image: ${sizeKB}KB`);
        
        // If image is larger than 500KB, we might need compression
        // For now, just return original but log the size
        if (sizeKB > 500) {
            console.log('Large image detected - processing with low detail');
        }
        
        return base64Image;
        
    } catch (error) {
        console.warn('Image compression failed:', error.message);
        return base64Image;
    }
}