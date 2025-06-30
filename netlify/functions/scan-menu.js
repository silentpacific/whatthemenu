exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        const { image } = JSON.parse(event.body);
        
        // Optimize image size before sending
        const optimizedImage = await optimizeImageSize(image);
        
        const startTime = Date.now();
        console.log('Starting OpenAI call...');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
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
                        text: "List menu dishes as JSON: {\"sections\":[{\"name\":\"Section\",\"emoji\":\"🍽️\",\"dishes\":[{\"name\":\"dish\",\"originalDescription\":\"desc\",\"aiExplanation\":\"explanation\"}]}]}"
                    }, {
                        type: "image_url",
                        image_url: { 
                            url: `data:image/jpeg;base64,${optimizedImage}`,
                            detail: "low" // Use low detail for speed
                        }
                    }]
                }],
                max_tokens: 500, // Reduced for speed
                temperature: 0.1 // Lower temperature for speed
            })
        });

        const duration = Date.now() - startTime;
        console.log(`OpenAI responded in ${duration}ms with status:`, response.status);

        if (!response.ok) {
            const error = await response.text();
            console.log('OpenAI error:', error);
            throw new Error(`OpenAI failed: ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        
        const parsedContent = JSON.parse(content);
        
        console.log(`Total processing time: ${Date.now() - startTime}ms`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: parsedContent })
        };

    } catch (error) {
        console.error('Function error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};

// Optimize image size for faster processing
async function optimizeImageSize(base64Image) {
    try {
        // Decode base64 to get image info
        const imageBuffer = Buffer.from(base64Image, 'base64');
        
        // If image is larger than 1MB, it's probably too big
        if (imageBuffer.length > 1024 * 1024) {
            console.log('Large image detected, using low detail mode');
        }
        
        // For now, return as-is but log size
        console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(0)}KB`);
        return base64Image;
        
    } catch (error) {
        console.log('Image optimization failed, using original');
        return base64Image;
    }
}