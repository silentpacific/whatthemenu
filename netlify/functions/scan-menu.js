// netlify/functions/create-payment.js - Updated for your existing schema

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const sharp = require('sharp');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Initialize Google Cloud Vision client
const vision = new ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-vision-api.json'
});

// Pass plans matching your user_subscriptions table
const PASS_PLANS = {
    'daily_pass': {
        name: 'Daily Pass',
        amount: 100, // $1.00 in cents
        currency: 'usd',
        duration_hours: 24,
        description: '24-hour unlimited menu scanning access'
    },
    'weekly_pass': {
        name: 'Weekly Pass', 
        amount: 500, // $5.00 in cents
        currency: 'usd',
        duration_hours: 168, // 7 days
        description: '7-day unlimited menu scanning access'
    }
};

/**
 * Get or create Stripe customer
 */
async function getOrCreateCustomer(email, name = null) {
    try {
        const existingCustomers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            return existingCustomers.data[0];
        }

        const customer = await stripe.customers.create({
            email: email,
            name: name,
            metadata: {
                source: 'what_the_menu_app',
                created_at: new Date().toISOString()
            }
        });

        return customer;
    } catch (error) {
        console.error('Error creating/retrieving customer:', error);
        throw new Error('Failed to process customer information');
    }
}

/**
 * Create payment intent
 */
async function createPaymentIntent(customer, planId, metadata = {}) {
    const plan = PASS_PLANS[planId];
    
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: plan.amount,
            currency: plan.currency,
            customer: customer.id,
            automatic_payment_methods: {
                enabled: true
            },
            metadata: {
                plan_id: planId,
                plan_name: plan.name,
                duration_hours: plan.duration_hours,
                customer_email: customer.email,
                ...metadata
            },
            description: `${plan.name} - ${plan.description}`
        });

        return paymentIntent;
    } catch (error) {
        console.error('Error creating payment intent:', error);
        throw new Error('Failed to create payment intent');
    }
}

/**
 * Handle successful payment webhook (create this as a separate function)
 */
async function handleSuccessfulPayment(paymentIntentId) {
    try {
        // Get payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return;
        }

        const planId = paymentIntent.metadata.plan_id;
        const plan = PASS_PLANS[planId];
        const customerEmail = paymentIntent.metadata.customer_email;

        // Find user by email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', customerEmail)
            .single();

        if (userError || !user) {
            console.error('User not found for payment:', customerEmail);
            return;
        }

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + plan.duration_hours * 60 * 60 * 1000);

        // Create subscription record
        const { error: subError } = await supabase
            .from('user_subscriptions')
            .insert([{
                user_id: user.id,
                subscription_type: planId,
                status: 'active',
                price_cents: plan.amount,
                currency: plan.currency,
                starts_at: startTime.toISOString(),
                expires_at: endTime.toISOString(),
                stripe_payment_intent_id: paymentIntentId
            }]);

        if (subError) {
            console.error('Subscription creation error:', subError);
            return;
        }

        // Create transaction record
        await supabase
            .from('transactions')
            .insert([{
                user_id: user.id,
                stripe_payment_intent_id: paymentIntentId,
                amount: plan.amount / 100, // Convert to dollars
                currency: plan.currency,
                transaction_type: planId,
                status: 'completed',
                description: plan.description
            }]);

        console.log(`✅ Successfully processed payment for user ${user.id}, plan ${planId}`);
        
    } catch (error) {
        console.error('Payment processing error:', error);
    }
}

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

// Helper: Preprocess image for better OCR results
async function preprocessImage(base64Image) {
    try {
        const buffer = Buffer.from(base64Image, 'base64');
        // Apply multiple preprocessing techniques for better OCR
        const processedBuffer = await sharp(buffer)
            .resize(2048, null, { 
                withoutEnlargement: true,
                fit: 'inside'
            })
            .sharpen(1, 1, 2) // Enhance edges
            .normalize() // Normalize contrast
            .gamma(1.2) // Slight gamma correction
            .jpeg({ 
                quality: 90,
                progressive: true
            })
            .toBuffer();
        return processedBuffer;
    } catch (error) {
        console.error('Image preprocessing failed:', error);
        // Fallback to original image
        return Buffer.from(base64Image, 'base64');
    }
}

// Helper: Extract text blocks from Google Vision response
function extractTextBlocks(textAnnotations) {
    if (!textAnnotations || textAnnotations.length === 0) {
        return [];
    }
    // Skip the first element as it contains the full text
    const blocks = textAnnotations.slice(1);
    // Group text by vertical position (y-coordinate) to identify lines
    const lineGroups = [];
    const tolerance = 10; // pixels tolerance for same line
    blocks.forEach(block => {
        const vertices = block.boundingPoly.vertices;
        const centerY = (vertices[0].y + vertices[2].y) / 2;
        let addedToGroup = false;
        for (let group of lineGroups) {
            if (Math.abs(group.centerY - centerY) <= tolerance) {
                group.blocks.push(block);
                addedToGroup = true;
                break;
            }
        }
        if (!addedToGroup) {
            lineGroups.push({
                centerY,
                blocks: [block]
            });
        }
    });
    // Sort groups by Y position and extract text lines
    lineGroups.sort((a, b) => a.centerY - b.centerY);
    return lineGroups.map(group => {
        // Sort blocks within group by X position
        group.blocks.sort((a, b) => a.boundingPoly.vertices[0].x - b.boundingPoly.vertices[0].x);
        return group.blocks.map(block => block.description).join(' ').trim();
    }).filter(line => line.length > 0);
}

// Helper: Parse menu sections from text lines
function parseMenuSections(textLines) {
    const sections = [];
    let currentSection = null;
    // Common section keywords
    const sectionKeywords = [
        'appetizers', 'starters', 'entrees', 'main courses', 'mains', 'desserts', 
        'drinks', 'beverages', 'sides', 'salads', 'soups', 'pasta', 'pizza',
        'breakfast', 'lunch', 'dinner', 'specials', 'chef', 'daily', 'house',
        'signature', 'popular', 'recommended', 'vegetarian', 'vegan', 'gluten-free'
    ];
    // Common non-dish words to filter out
    const nonDishWords = [
        'price', '$', '€', '£', '¥', 'rs', 'inr', 'usd', 'euro', 'pound',
        'description', 'ingredients', 'contains', 'allergens', 'gluten', 'dairy',
        'nuts', 'vegetarian', 'vegan', 'spicy', 'hot', 'mild', 'served', 'with',
        'comes', 'includes', 'add', 'extra', 'side', 'sauce', 'dressing'
    ];
    for (let line of textLines) {
        const lowerLine = line.toLowerCase().trim();
        // Skip empty lines or very short lines
        if (lowerLine.length < 2) continue;
        // Check if this line is a section header
        const isSectionHeader = sectionKeywords.some(keyword => 
            lowerLine.includes(keyword) || 
            lowerLine.match(new RegExp(`^${keyword}`, 'i')) ||
            lowerLine.match(new RegExp(`^.*${keyword}.*$`, 'i'))
        );
        // Check for common section patterns
        const sectionPatterns = [
            /^[A-Z\s&]+$/, // ALL CAPS text
            /^[A-Z][a-z\s&]+:$/, // Title case with colon
            /^[A-Z][a-z\s&]+$/, // Title case
            /^\d+\.\s*[A-Z][a-z\s&]+/, // Numbered sections
        ];
        const matchesSectionPattern = sectionPatterns.some(pattern => pattern.test(line.trim()));
        if (isSectionHeader || matchesSectionPattern) {
            // Save previous section if exists
            if (currentSection && currentSection.dishes.length > 0) {
                sections.push(currentSection);
            }
            // Create new section
            currentSection = {
                section: line.trim(),
                dishes: []
            };
        } else if (currentSection) {
            // This might be a dish name
            const cleanLine = line.trim();
            // Filter out lines that are likely not dish names
            const hasNonDishWords = nonDishWords.some(word => 
                lowerLine.includes(word.toLowerCase())
            );
            const isLikelyPrice = /^\$?\d+\.?\d*$/.test(cleanLine) || 
                                 /^\d+\.?\d*\s*[€£¥₹]/.test(cleanLine);
            const isTooShort = cleanLine.length < 3;
            const isTooLong = cleanLine.length > 100;
            if (!hasNonDishWords && !isLikelyPrice && !isTooShort && !isTooLong) {
                currentSection.dishes.push({
                    name: cleanLine
                });
            }
        } else {
            // No section defined yet, create a default section
            currentSection = {
                section: 'Menu Items',
                dishes: []
            };
            const cleanLine = line.trim();
            if (cleanLine.length >= 3 && cleanLine.length <= 100) {
                currentSection.dishes.push({
                    name: cleanLine
                });
            }
        }
    }
    // Add the last section if it has dishes
    if (currentSection && currentSection.dishes.length > 0) {
        sections.push(currentSection);
    }
    // If no sections were found, create a default section with all lines
    if (sections.length === 0) {
        const defaultSection = {
            section: 'Menu Items',
            dishes: textLines
                .filter(line => line.trim().length >= 3 && line.trim().length <= 100)
                .map(line => ({ name: line.trim() }))
        };
        sections.push(defaultSection);
    }
    return sections;
}

// Helper: Fuzzy match dish names for better description lookup
function findBestMatch(dishName, availableDishes) {
    if (!availableDishes || availableDishes.length === 0) return null;
    const normalizedDishName = dishName.toLowerCase().replace(/[^\w\s]/g, '');
    // Exact match first
    const exactMatch = availableDishes.find(dish => 
        dish.name.toLowerCase() === normalizedDishName
    );
    if (exactMatch) return exactMatch;
    // Partial match
    const partialMatch = availableDishes.find(dish => 
        dish.name.toLowerCase().includes(normalizedDishName) ||
        normalizedDishName.includes(dish.name.toLowerCase())
    );
    if (partialMatch) return partialMatch;
    // Word-based match
    const dishWords = normalizedDishName.split(/\s+/);
    const wordMatch = availableDishes.find(dish => {
        const availableWords = dish.name.toLowerCase().split(/\s+/);
        return dishWords.some(word => 
            availableWords.some(availableWord => 
                availableWord.includes(word) || word.includes(availableWord)
            )
        );
    });
    return wordMatch || null;
}

exports.handler = async (event, context) => {
    const startTime = Date.now();
    console.log('Google Vision API function started');
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
        // 2. Preprocess image for better OCR
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        const processedImageBuffer = await preprocessImage(base64Image);
        console.log('Image preprocessing completed:', Date.now() - startTime, 'ms');
        // 3. Use Google Vision API for OCR
        const [result] = await vision.textDetection(processedImageBuffer);
        const detections = result.textAnnotations;
        console.log('Google Vision API response received:', Date.now() - startTime, 'ms');
        if (!detections || detections.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No text detected in the image. Please ensure the menu is clearly visible and well-lit.',
                    confidence: 0
                })
            };
        }
        // 4. Extract and parse text blocks
        const textLines = extractTextBlocks(detections);
        console.log('Extracted text lines:', textLines.length);
        if (textLines.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No readable text found in the image.',
                    confidence: 0
                })
            };
        }
        // 5. Parse menu sections from text lines
        const parsedSections = parseMenuSections(textLines);
        console.log('Parsed sections:', parsedSections.length);
        if (parsedSections.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Could not identify menu items in the image.',
                    confidence: 0
                })
            };
        }
        // 6. Get all available dishes from Supabase for better matching
        const { data: availableDishes, error: dishesError } = await supabase
            .from('dishes')
            .select('name, explanation');
        if (dishesError) {
            console.error('Error fetching available dishes:', dishesError);
        }
        // 7. Enrich sections with dish descriptions using fuzzy matching
        const enrichedSections = [];
        for (const section of parsedSections) {
            const enrichedSection = { ...section };
            if (section.dishes && section.dishes.length > 0) {
                enrichedSection.dishes = [];
                for (const dish of section.dishes) {
                    // Try to find the best match for this dish
                    const matchedDish = availableDishes ? 
                        findBestMatch(dish.name, availableDishes) : null;
                    enrichedSection.dishes.push({
                        ...dish,
                        description: matchedDish?.explanation || 'No description available',
                        matched: matchedDish ? true : false
                    });
                }
            }
            enrichedSections.push(enrichedSection);
        }
        // 8. Store scan in Supabase
        const { data: scanInsertData, error: scanError } = await supabase.from('menu_scans').insert([
            {
                user_id: userId || null,
                session_id: sessionId || null,
                tier: userTier,
                menu_json: enrichedSections,
                created_at: new Date().toISOString()
            }
        ]).select().single();
        if (scanError) {
            console.error('Supabase scan insert error:', scanError);
        }
        // 9. Calculate confidence score based on text detection quality
        const totalTextLength = detections[0]?.description?.length || 0;
        const confidence = Math.min(100, Math.max(0, 
            Math.floor((totalTextLength / 100) * 50) + 
            (enrichedSections.length > 0 ? 30 : 0) +
            (enrichedSections.reduce((sum, section) => sum + section.dishes.length, 0) > 0 ? 20 : 0)
        ));
        // 10. Return structured menu with descriptions
        const responseData = {
            success: true,
            data: {
                sections: enrichedSections,
                userTier: userTier,
                userId: userId || '',
                scanId: scanInsertData?.id || 'temp_' + Date.now(),
                processingTime: Date.now() - startTime,
                rawText: detections[0]?.description || '',
                confidence: confidence,
                source: 'google-vision',
                totalDishes: enrichedSections.reduce((sum, section) => sum + section.dishes.length, 0),
                totalSections: enrichedSections.length
            }
        };
        console.log('Function completed successfully:', Date.now() - startTime, 'ms');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };
    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to process menu image: ' + error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};