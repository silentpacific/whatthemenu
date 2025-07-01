// netlify/functions/create-payment.js - Updated for your existing schema

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

/**
 * Main function handler
 */
exports.handler = async (event, context) => {
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
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { planId, email, name, metadata = {} } = JSON.parse(event.body);

        // Validate inputs
        if (!planId || !PASS_PLANS[planId]) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid plan type' })
            };
        }

        if (!email || !email.includes('@')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Valid email address is required' })
            };
        }

        console.log(`Processing payment for plan: ${planId}, email: ${email}`);

        // Get or create customer
        const customer = await getOrCreateCustomer(email, name);
        
        // Create payment intent
        const paymentIntent = await createPaymentIntent(customer, planId, metadata);

        const response = {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            customerId: customer.id,
            plan: PASS_PLANS[planId],
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

        let errorMessage = 'Failed to create payment';
        let statusCode = 500;

        if (error.message.includes('Invalid plan') || 
            error.message.includes('Valid email address is required')) {
            errorMessage = error.message;
            statusCode = 400;
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