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

// Parse menu using font size hierarchy from Google Vision API
function parseMenuByFontSize(detections) {
    if (!detections || detections.length < 2) {
        return [{ section: 'Menu Items', dishes: [] }];
    }
    
    // Skip the first annotation (contains all text)
    const textBlocks = detections.slice(1);
    
    // Calculate font sizes based on bounding box heights
    const textWithSizes = textBlocks.map(block => {
        const vertices = block.boundingPoly.vertices;
        const height = Math.abs(vertices[2].y - vertices[0].y);
        return {
            text: block.description,
            fontSize: height,
            y: vertices[0].y, // Top position for sorting
            block: block
        };
    });
    
    // Sort by Y position (top to bottom)
    textWithSizes.sort((a, b) => a.y - b.y);
    
    // Group by font size to identify hierarchy
    const fontSizes = [...new Set(textWithSizes.map(item => item.fontSize))].sort((a, b) => b - a);
    
    // Categorize by font size (largest = heading, second = sections, third = dishes, fourth = descriptions)
    const categories = {
        heading: fontSizes[0] || 0,
        sections: fontSizes[1] || fontSizes[0] || 0,
        dishes: fontSizes[2] || fontSizes[1] || fontSizes[0] || 0,
        descriptions: fontSizes[3] || fontSizes[2] || fontSizes[1] || fontSizes[0] || 0
    };
    
    // Tolerance for font size matching (within 10% of target size)
    const tolerance = 0.1;
    
    const sections = [];
    let currentSection = { section: 'Menu Items', dishes: [] };
    let currentDish = null;
    let dishDescription = [];
    
    for (const item of textWithSizes) {
        const text = item.text.trim();
        if (text.length < 2) continue;
        
        // Skip prices and numbers
        if (/^\$?\d+\.?\d*$/.test(text) || /^\d+\/\d+$/.test(text)) continue;
        
        // Determine category based on font size
        let category = 'descriptions'; // default
        if (Math.abs(item.fontSize - categories.heading) <= categories.heading * tolerance) {
            category = 'heading';
        } else if (Math.abs(item.fontSize - categories.sections) <= categories.sections * tolerance) {
            category = 'sections';
        } else if (Math.abs(item.fontSize - categories.dishes) <= categories.dishes * tolerance) {
            category = 'dishes';
        }
        
        if (category === 'sections') {
            // Save current dish
            if (currentDish) {
                currentSection.dishes.push({
                    name: currentDish,
                    description: dishDescription.join(' ')
                });
            }
            
            // Start new section
            if (currentSection.dishes.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { section: text, dishes: [] };
            currentDish = null;
            dishDescription = [];
        } else if (category === 'dishes') {
            // Save previous dish
            if (currentDish) {
                currentSection.dishes.push({
                    name: currentDish,
                    description: dishDescription.join(' ')
                });
            }
            currentDish = text;
            dishDescription = [];
        } else if (category === 'descriptions' && currentDish) {
            // Add to current dish description
            dishDescription.push(text);
        }
        // Ignore headings for now (restaurant name, etc.)
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

// Fallback parsing for when font size info is not available
function parseMenuSections(textLines) {
    const sections = [];
    let currentSection = { section: 'Menu Items', dishes: [] };
    
    // Filter out empty lines and very short lines
    const filteredLines = textLines.filter(line => line.trim().length > 2);
    
    let currentDish = '';
    let dishDescription = [];
    
    for (let i = 0; i < filteredLines.length; i++) {
        const line = filteredLines[i].trim();
        
        // Skip prices and numbers
        if (/^\$?\d+\.?\d*$/.test(line) || /^\d+\/\d+$/.test(line)) continue;
        
        // Check if this looks like a section header (all caps, 3-15 characters)
        const isSectionHeader = line === line.toUpperCase() && line.length >= 3 && line.length <= 15;
        
        if (isSectionHeader) {
            // Save current dish
            if (currentDish) {
                currentSection.dishes.push({
                    name: currentDish,
                    description: dishDescription.join(' ')
                });
            }
            
            // Start new section
            if (currentSection.dishes.length > 0) {
                sections.push(currentSection);
            }
            currentSection = { section: line, dishes: [] };
            currentDish = '';
            dishDescription = [];
        } else {
            // This is part of a dish
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
                    
                    // Debug: Log the raw text structure
                    console.log('Raw text from Vision API:', detections[0]?.description);
                    console.log('First few text blocks:', detections.slice(1, 5).map(block => ({
                        text: block.description,
                        bounds: block.boundingPoly?.vertices
                    })));
                    
                    // Parse the already well-structured text from Google Vision API
                    const rawText = detections[0]?.description || '';
                    const textLines = rawText.split('\n').filter(line => line.trim().length > 0);
                    
                    console.log('Parsing text lines:', textLines.length);
                    
                    const sections = [];
                    let currentSection = { section: 'Menu Items', dishes: [] };
                    let currentDish = '';
                    let currentPrice = '';
                    let dishDescription = [];
                    
                    for (let i = 0; i < textLines.length; i++) {
                        const line = textLines[i].trim();
                        
                        // Skip empty lines
                        if (line.length === 0) continue;
                        
                        console.log(`Processing line ${i}: "${line}"`);
                        
                        // Check if this is a section header (starts with - or is all caps and short)
                        const isSectionHeader = line.startsWith('-') || 
                                              (line === line.toUpperCase() && line.length > 2 && line.length < 25 && !line.includes(' '));
                        
                        // Check if this line contains a dish name with price (e.g., "DISH NAME 12")
                        const dishWithPriceMatch = line.match(/^(.+?)\s+(\d+)$/);
                        
                        // Check if this is just a price (e.g., "12")
                        const isJustPrice = /^\d+$/.test(line);
                        
                        if (isSectionHeader) {
                            console.log(`Found section header: "${line}"`);
                            
                            // Save current dish before starting new section
                            if (currentDish) {
                                currentSection.dishes.push({
                                    name: currentDish,
                                    price: currentPrice,
                                    description: dishDescription.join(' ')
                                });
                                console.log(`Saved dish: "${currentDish}" with price "${currentPrice}" and description "${dishDescription.join(' ')}"`);
                            }
                            
                            // Start new section
                            if (currentSection.dishes.length > 0) {
                                sections.push(currentSection);
                            }
                            
                            // Clean section name (remove dashes, etc.)
                            const cleanSectionName = line.replace(/^[- ]+/, '').replace(/[- ]+$/, '');
                            currentSection = { section: cleanSectionName, dishes: [] };
                            currentDish = '';
                            currentPrice = '';
                            dishDescription = [];
                        } else if (dishWithPriceMatch) {
                            // This line has both dish name and price
                            console.log(`Found dish with price: "${dishWithPriceMatch[1]}" - "${dishWithPriceMatch[2]}"`);
                            
                            // Save previous dish if exists
                            if (currentDish) {
                                currentSection.dishes.push({
                                    name: currentDish,
                                    price: currentPrice,
                                    description: dishDescription.join(' ')
                                });
                                console.log(`Saved previous dish: "${currentDish}"`);
                            }
                            
                            // Start new dish
                            currentDish = dishWithPriceMatch[1].trim();
                            currentPrice = dishWithPriceMatch[2];
                            dishDescription = [];
                        } else if (isJustPrice) {
                            // This is just a price, associate with current dish
                            console.log(`Found price: "${line}"`);
                            currentPrice = line;
                        } else {
                            // This is either a dish name without price or a description
                            if (!currentDish) {
                                // First non-section, non-price line = dish name
                                console.log(`Found dish name: "${line}"`);
                                currentDish = line;
                            } else {
                                // Check if this looks like a new dish (starts with capital letters and is short)
                                const isNewDish = /^[A-Z]/.test(line) && line.length > 3 && line.length < 50 && !line.includes(',');
                                
                                if (isNewDish && dishDescription.length === 0) {
                                    // This might be a new dish, save the previous one
                                    console.log(`Found new dish, saving previous: "${currentDish}"`);
                                    currentSection.dishes.push({
                                        name: currentDish,
                                        price: currentPrice,
                                        description: ''
                                    });
                                    currentDish = line;
                                    currentPrice = '';
                                } else {
                                    // This is a description line
                                    console.log(`Adding description: "${line}"`);
                                    dishDescription.push(line);
                                }
                            }
                        }
                    }
                    
                    // Add the last dish
                    if (currentDish) {
                        currentSection.dishes.push({
                            name: currentDish,
                            price: currentPrice,
                            description: dishDescription.join(' ')
                        });
                        console.log(`Saved final dish: "${currentDish}" with price "${currentPrice}"`);
                    }
                    
                    if (currentSection.dishes.length > 0) {
                        sections.push(currentSection);
                    }
                    
                    console.log('Final sections:', JSON.stringify(sections, null, 2));
                    
                    result = {
                        success: true,
                        data: {
                            sections: sections,
                            userTier: 'free',
                            userId: userId || '',
                            scanId: 'temp_' + Date.now(),
                            processingTime: Date.now() - startTime,
                            rawText: rawText,
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