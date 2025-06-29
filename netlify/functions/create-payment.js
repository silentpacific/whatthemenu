// netlify/functions/create-payment.js - Payment processing serverless function

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
    'food_explorer_monthly': {
        name: 'Food Explorer',
        amount: 999, // $9.99 in cents
        currency: 'usd',
        interval: 'month',
        features: ['Unlimited scans', 'Advanced AI', '50+ languages', 'Dietary info']
    },
    'travel_pro_yearly': {
        name: 'Travel Pro',
        amount: 9900, // $99.00 in cents
        currency: 'usd',
        interval: 'year',
        features: ['Everything in Food Explorer', 'Offline mode', 'Priority support']
    }
};

/**
 * Validate environment variables
 */
function validateEnvironment() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Missing STRIPE_SECRET_KEY environment variable');
    }
    if (!process.env.STRIPE_PUBLISHABLE_KEY) {
        throw new Error('Missing STRIPE_PUBLISHABLE_KEY environment variable');
    }
}

/**
 * Validate request data
 */
function validateRequest(data) {
    const { planId, email } = data;

    if (!planId || !SUBSCRIPTION_PLANS[planId]) {
        throw new Error('Invalid subscription plan');
    }

    if (!email || !isValidEmail(email)) {
        throw new Error('Valid email address is required');
    }

    return true;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Create or retrieve customer
 */
async function getOrCreateCustomer(email, name = null) {
    try {
        // Check if customer already exists
        const existingCustomers = await stripe.customers.list({
            email: email,
            limit: 1
        });

        if (existingCustomers.data.length > 0) {
            return existingCustomers.data[0];
        }

        // Create new customer
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
 * Create payment intent for subscription
 */
async function createPaymentIntent(customer, planId, metadata = {}) {
    const plan = SUBSCRIPTION_PLANS[planId];
    
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
                customer_email: customer.email,
                ...metadata
            },
            description: `${plan.name} subscription - What The Menu?`
        });

        return paymentIntent;
    } catch (error) {
        console.error('Error creating payment intent:', error);
        throw new Error('Failed to create payment intent');
    }
}

/**
 * Create subscription (for future use when payment is confirmed)
 */
async function createSubscription(customerId, planId) {
    const plan = SUBSCRIPTION_PLANS[planId];
    
    try {
        // In a real implementation, you'd create a Stripe subscription
        // For now, we'll just create a payment intent
        console.log(`Would create subscription for customer ${customerId} with plan ${planId}`);
        
        return {
            id: `sub_${Date.now()}`,
            status: 'active',
            plan: plan.name,
            interval: plan.interval
        };
    } catch (error) {
        console.error('Error creating subscription:', error);
        throw new Error('Failed to create subscription');
    }
}

/**
 * Log transaction for analytics
 */
function logTransaction(data) {
    console.log('Payment transaction:', {
        timestamp: new Date().toISOString(),
        plan_id: data.planId,
        customer_email: data.email,
        amount: SUBSCRIPTION_PLANS[data.planId]?.amount,
        currency: SUBSCRIPTION_PLANS[data.planId]?.currency
    });
}

/**
 * Main function handler
 */
exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Validate environment
        validateEnvironment();

        // Parse request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { planId, email, name, metadata = {} } = requestBody;

        // Validate request data
        validateRequest({ planId, email });

        console.log(`Processing payment for plan: ${planId}, email: ${email}`);

        // Get or create customer
        const customer = await getOrCreateCustomer(email, name);
        
        // Create payment intent
        const paymentIntent = await createPaymentIntent(customer, planId, metadata);

        // Log transaction
        logTransaction({ planId, email });

        // Return success response
        const response = {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customer.id,
            plan: SUBSCRIPTION_PLANS[planId],
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
        };

        console.log(`Payment intent created successfully: ${paymentIntent.id}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Payment creation error:', error);

        // Return appropriate error response
        let errorMessage = 'Failed to create payment';
        let statusCode = 500;

        if (error.message.includes('Invalid subscription plan') || 
            error.message.includes('Valid email address is required')) {
            errorMessage = error.message;
            statusCode = 400;
        } else if (error.message.includes('insufficient_quota') || 
                   error.message.includes('rate_limit')) {
            errorMessage = 'Service temporarily unavailable. Please try again later.';
            statusCode = 503;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({ 
                error: errorMessage,
                timestamp: new Date().toISOString()
            })
        };
    }
};