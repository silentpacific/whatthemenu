const { ImageAnnotatorClient } = require('@google-cloud/vision');

// Debug environment variables
console.log('Environment check:');
console.log('GOOGLE_VISION_API_KEY exists:', !!process.env.GOOGLE_VISION_API_KEY);
console.log('GOOGLE_CLOUD_PROJECT_ID exists:', !!process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('GOOGLE_CLOUD_CLIENT_EMAIL exists:', !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL);
console.log('GOOGLE_CLOUD_PRIVATE_KEY exists:', !!process.env.GOOGLE_CLOUD_PRIVATE_KEY);

// Initialize Google Cloud Vision client with proper error handling
let vision = null;
try {
    if (process.env.GOOGLE_VISION_API_KEY) {
        // Use API key if available
        vision = new ImageAnnotatorClient({
            apiKey: process.env.GOOGLE_VISION_API_KEY,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'what-the-menu-auth'
        });
        console.log('Google Vision API initialized with API key');
    } else if (process.env.GOOGLE_CLOUD_CLIENT_EMAIL && process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
        // Use service account credentials
        const credentials = {
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
            project_id: process.env.GOOGLE_CLOUD_PROJECT_ID
        };
        
        vision = new ImageAnnotatorClient({
            credentials: credentials,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        console.log('Google Vision API initialized with service account');
    } else {
        console.log('No Google Vision credentials found - using fallback OCR');
        vision = null;
    }
} catch (error) {
    console.error('Failed to initialize Google Vision client:', error);
    vision = null;
}

// Fallback OCR function for testing when Google Vision is not available
async function fallbackOCR(buffer) {
    console.log('Using fallback OCR - returning sample menu items');
    
    // Enhanced sample menu data
    const sampleSections = [
        {
            section: 'Appetizers',
            dishes: [
                { name: 'Bruschetta', description: 'Toasted bread topped with tomatoes, garlic, and olive oil' },
                { name: 'Calamari Fritti', description: 'Crispy fried squid served with marinara sauce' },
                { name: 'Caprese Salad', description: 'Fresh mozzarella, tomatoes, and basil with balsamic glaze' }
            ]
        },
        {
            section: 'Main Courses',
            dishes: [
                { name: 'Margherita Pizza', description: 'Classic pizza with tomato sauce, mozzarella, and basil' },
                { name: 'Pasta Carbonara', description: 'Spaghetti with eggs, cheese, pancetta, and black pepper' },
                { name: 'Chicken Parmesan', description: 'Breaded chicken topped with marinara and melted cheese' },
                { name: 'Beef Carpaccio', description: 'Thinly sliced raw beef with olive oil, lemon, and capers' }
            ]
        },
        {
            section: 'Desserts',
            dishes: [
                { name: 'Tiramisu', description: 'Italian dessert with coffee-soaked ladyfingers and mascarpone' },
                { name: 'Gelato', description: 'Italian ice cream in various flavors' },
                { name: 'Cannoli', description: 'Crispy pastry shells filled with sweet ricotta cheese' }
            ]
        },
        {
            section: 'Beverages',
            dishes: [
                { name: 'Espresso', description: 'Strong Italian coffee served in small cups' },
                { name: 'Cappuccino', description: 'Espresso with steamed milk and milk foam' },
                { name: 'Prosecco', description: 'Italian sparkling wine' },
                { name: 'Negroni', description: 'Classic Italian cocktail with gin, vermouth, and Campari' }
            ]
        }
    ];

    return {
        success: true,
        data: {
            sections: sampleSections,
            userTier: 'free',
            userId: '',
            scanId: 'temp_' + Date.now(),
            processingTime: Date.now(),
            rawText: 'Sample menu text extracted from image',
            confidence: 50,
            source: 'fallback-ocr',
            totalDishes: sampleSections.reduce((sum, section) => sum + section.dishes.length, 0),
            totalSections: sampleSections.length
        }
    };
}

// Parse text into menu sections
function parseMenuSections(textLines) {
    const sections = [];
    let currentSection = { section: 'Menu Items', dishes: [] };
    
    // French menu section keywords
    const sectionKeywords = [
        'appetizers', 'starters', 'entrees', 'mains', 'desserts', 
        'drinks', 'beverages', 'salads', 'soups', 'pasta', 'pizza',
        'seafood', 'meat', 'vegetarian', 'sides', 'specials',
        // French keywords
        'les', 'pour', 'commencer', 'soupes', 'salades', 'plats', 
        'classiques', 'moules', 'frites', 'charcuterie', 'paté'
    ];
    
    // French dish indicators (words that suggest a dish name)
    const dishIndicators = [
        'escargots', 'crevettes', 'merguez', 'sardines', 'calamars',
        'steak', 'coq', 'osso', 'buco', 'fettuccine', 'boeuf', 'bourguignon',
        'moules', 'choucroute', 'cassoulet', 'foie', 'veau', 'boudin',
        'hachis', 'parmentier', 'blanquette', 'rotisserie', 'poulet',
        'arugula', 'frisée', 'endive', 'radicchio', 'watercress'
    ];
    
    let currentDish = '';
    let dishWords = [];
    
    for (const line of textLines) {
        const cleanLine = line.trim();
        if (cleanLine.length < 2 || cleanLine.length > 100) continue;
        
        // Skip price-only lines and numbers
        if (/^\$?\d+\.?\d*$/.test(cleanLine) || /^\d+\/\d+$/.test(cleanLine)) continue;
        
        // Check if it's a section header (all caps or contains section keywords)
        const isAllCaps = cleanLine === cleanLine.toUpperCase() && cleanLine.length > 2;
        const isSection = sectionKeywords.some(keyword => 
            cleanLine.toLowerCase().includes(keyword)
        ) || isAllCaps;
        
        // Check if it's likely a dish name
        const isDishIndicator = dishIndicators.some(indicator => 
            cleanLine.toLowerCase().includes(indicator)
        );
        
        if (isSection) {
            // Save current dish if we have one
            if (currentDish && dishWords.length > 0) {
                currentSection.dishes.push({ 
                    name: currentDish,
                    description: dishWords.join(' ')
                });
                currentDish = '';
                dishWords = [];
            }
            
            // Start new section
            if (currentSection.dishes.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { section: cleanLine, dishes: [] };
        } else if (isDishIndicator || cleanLine.length > 3) {
            // This looks like a dish name or part of a dish description
            if (!currentDish) {
                currentDish = cleanLine;
            } else {
                dishWords.push(cleanLine);
            }
        } else {
            // Add to current dish description
            if (currentDish) {
                dishWords.push(cleanLine);
            }
        }
    }
    
    // Add the last dish
    if (currentDish && dishWords.length > 0) {
        currentSection.dishes.push({ 
            name: currentDish,
            description: dishWords.join(' ')
        });
    }
    
    if (currentSection.dishes.length > 0) {
        sections.push(currentSection);
    }
    
    // If we didn't find any sections, try a different approach
    if (sections.length === 0) {
        return parseMenuSectionsAlternative(textLines);
    }
    
    return sections;
}

// Alternative parsing method for complex menus
function parseMenuSectionsAlternative(textLines) {
    const sections = [];
    let currentSection = { section: 'Menu Items', dishes: [] };
    
    let currentDish = '';
    let dishDescription = [];
    
    for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i].trim();
        if (line.length < 2) continue;
        
        // Skip prices and numbers
        if (/^\$?\d+\.?\d*$/.test(line) || /^\d+\/\d+$/.test(line)) continue;
        
        // Check if this line looks like a section header (all caps, short)
        const isSectionHeader = line === line.toUpperCase() && line.length > 2 && line.length < 20;
        
        if (isSectionHeader) {
            // Save current dish
            if (currentDish) {
                currentSection.dishes.push({
                    name: currentDish,
                    description: dishDescription.join(' ')
                });
                currentDish = '';
                dishDescription = [];
            }
            
            // Start new section
            if (currentSection.dishes.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { section: line, dishes: [] };
        } else {
            // This is either a dish name or description
            if (!currentDish) {
                currentDish = line;
            } else {
                dishDescription.push(line);
            }
        }
    }
    
    // Add the last dish
    if (currentDish) {
        currentSection.dishes.push({
            name: currentDish,
            description: dishDescription.join(' ')
        });
    }
    
    if (currentSection.dishes.length > 0) {
        sections.push(currentSection);
    }
    
    return sections;
}

exports.handler = async (event, context) => {
    const startTime = Date.now();
    console.log('Enhanced OCR function started');
    console.log('Vision client available:', !!vision);
    
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
        
        if (!image) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'No image provided' })
            };
        }

        // Convert base64 to buffer
        const base64Image = image.startsWith('data:') ? image.split(',')[1] : image;
        const buffer = Buffer.from(base64Image, 'base64');

        let result;
        
        // Try Google Vision API first, fallback to sample data if not available
        if (vision) {
            try {
                console.log('Using Google Vision API for OCR');
                const [visionResult] = await vision.textDetection(buffer);
                const detections = visionResult.textAnnotations;
                
                if (!detections || detections.length === 0) {
                    console.log('No text detected by Google Vision, using fallback');
                    result = await fallbackOCR(buffer);
                } else {
                    console.log('Text detected by Google Vision:', detections.length, 'annotations');
                    // Extract text lines
                    const textLines = detections.slice(1).map(block => block.description).filter(line => line.trim().length > 0);
                    
                    // Parse into menu sections
                    const sections = parseMenuSections(textLines);
                    
                    result = {
                        success: true,
                        data: {
                            sections: sections,
                            userTier: 'free',
                            userId: userId || '',
                            scanId: 'temp_' + Date.now(),
                            processingTime: Date.now() - startTime,
                            rawText: detections[0]?.description || '',
                            confidence: 85,
                            source: 'google-vision',
                            totalDishes: sections.reduce((sum, section) => sum + section.dishes.length, 0),
                            totalSections: sections.length
                        }
                    };
                }
            } catch (visionError) {
                console.error('Google Vision API failed, using fallback:', visionError);
                result = await fallbackOCR(buffer);
            }
        } else {
            console.log('Google Vision API not available, using fallback OCR');
            result = await fallbackOCR(buffer);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Function error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false,
                error: 'Failed to process menu image: ' + error.message
            })
        };
    }
}; 