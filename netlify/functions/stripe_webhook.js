// netlify/functions/stripe-webhook.js - Handle payment confirmations

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PASS_PLANS = {
    'daily_pass': {
        duration_hours: 24,
        amount: 100
    },
    'weekly_pass': {
        duration_hours: 168,
        amount: 500
    }
};

/**
 * Handle payment success
 */
async function handlePaymentSuccess(paymentIntent) {
    try {
        const planId = paymentIntent.metadata.plan_id;
        const plan = PASS_PLANS[planId];
        const customerEmail = paymentIntent.metadata.customer_email;

        if (!plan) {
            console.error('Unknown plan ID:', planId);
            return;
        }

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
                currency: 'usd',
                starts_at: startTime.toISOString(),
                expires_at: endTime.toISOString(),
                stripe_payment_intent_id: paymentIntent.id
            }]);

        if (subError) {
            console.error('Subscription creation error:', sub