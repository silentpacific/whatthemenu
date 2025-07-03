const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper: Get user tier from user_subscriptions table
async function getUserTier(userId) {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_type')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('Supabase user_subscriptions lookup error:', error);
        return 'free'; // fallback to free
    }
    return data && data.subscription_type ? data.subscription_type : 'free';
}

// Helper: Count scans for user (for free tier limit)
async function getUserScanCount(userId) {
    const { count, error } = await supabase
        .from('menu_scans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
    if (error) return 0;
    return count || 0;
}

// Helper: Count scans for session (for anonymous free tier)
async function getSessionScanCount(sessionId) {
    const { count, error } = await supabase
        .from('menu_scans')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', sessionId);
    if (error) return 0;
    return count || 0;
}

// Simple text parsing function to extract dish names
function parseMenuText(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const sections = [];
    let currentSection = null;
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip lines that are likely prices, numbers, or too short
        if (trimmedLine.length < 3 || /^\d+\.?\d*$/.test(trimmedLine) || /^\$?\d+\.?\d*$/.test(trimmedLine)) {
            continue;
        }
        
        // Check if this looks like a section header (all caps, common section names)
        const sectionKeywords = ['APPETIZERS', 'STARTERS', 'MAIN', 'ENTREES', 'DESSERTS', 'DRINKS', 'BEVERAGES', 'SALADS', 'SOUPS', 'PASTA', 'PIZZA', 'BURGERS', 'SANDWICHES'];
        const isSectionHeader = sectionKeywords.some(keyword => 
            trimmedLine.toUpperCase().includes(keyword) || 
            trimmedLine.length < 20 && trimmedLine === trimmedLine.toUpperCase()
        );
        
        if (isSectionHeader) {
            if (currentSection && currentSection.dishes.length > 0) {
                sections.push(currentSection);
            }
            currentSection = {
                name: trimmedLine,
                dishes: []
            };
        } else if (currentSection) {
            // This is likely a dish name
            currentSection.dishes.push({
                name: trimmedLine
            });
        } else {
            // No section yet, create a default one
            currentSection = {
                name: 'Menu Items',
                dishes: [{
                    name: trimmedLine
                }]
            };
        }
    }
    
    // Add the last section if it has dishes
    if (currentSection && currentSection.dishes.length > 0) {
        sections.push(currentSection);
    }
    
    // If no sections were found, create one with all items
    if (sections.length === 0) {
        const allDishes = lines
            .filter(line => line.trim().length > 3 && !/^\d+\.?\d*$/.test(line.trim()))
            .map(line => ({ name: line.trim() }));
        
        if (allDishes.length > 0) {
            sections.push({
                name: 'Menu Items',
                dishes: allDishes
            });
        }
    }
    
    return sections;
}

exports.handler = async (event, context) => {
    const startTime = Date.now();
    console.log('Function started');
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        const { image, userId, sessionId } = JSON.parse(event.body || '{}');
        if (!image || (!userId && !sessionId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image or session/user ID provided' })
            };
        }

        // 1. Determine tier and enforce scan limits
        let userTier = 'free';
        if (userId) {
            userTier = await getUserTier(userId);
            if (userTier === 'free') {
                const scanCount = await getUserScanCount(userId);
                if (scanCount >= 5) {
                    return {
                        statusCode: 429,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            error: 'Free tier scan limit reached. Please upgrade to continue.',
                            scansRemaining: 0
                        })
                    };
                }
            }
        } else {
            // Anonymous user (sessionId)
            const scanCount = await getSessionScanCount(sessionId);
            if (scanCount >= 5) {
                return {
                    statusCode: 429,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        error: 'Free tier scan limit reached. Please create an account or upgrade to continue.',
                        scansRemaining: 0
                    })
                };
            }
        }

        // 2. Process image with sharp for optimization
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        const resizedBuffer = await sharp(Buffer.from(base64Image, 'base64'))
            .resize(1024, null, { withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer();
        
        // 3. For now, return a message that OCR should be done client-side
        // In a real implementation, you'd use a server-side OCR library here
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    message: 'OCR processing should be done client-side with Tesseract.js',
                    userTier,
                    userId: userId || '',
                    scanId: 'temp_' + Date.now(),
                    processingTime: Date.now() - startTime
                }
            })
        };

    } catch (error) {
        console.error('❌ scan-menu-tesseract error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            })
        };
    }
}; 