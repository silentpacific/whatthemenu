# What The Menu? 🤔

AI-powered menu scanner and translator for confident dining worldwide.

## Features

- 🌍 **50+ Languages** - Support for major world languages
- ⚡ **Instant Translation** - Get results in seconds
- 🤖 **AI-Powered** - Advanced OCR and translation technology
- 📱 **Mobile-Friendly** - Works on all devices
- 🔒 **Secure** - Payments processed by Stripe
- 💡 **Smart Analysis** - Dietary info and ingredient details

## How It Works

1. **Upload Photo** - Take or upload a menu photo
2. **AI Analysis** - Our AI reads and understands the menu
3. **Get Translation** - Receive instant translations with descriptions

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Netlify Functions
- **AI**: OpenAI GPT-4 Vision
- **Payments**: Stripe
- **Database**: Supabase
- **Hosting**: Netlify

## Setup Instructions

### 1. Environment Variables

Add these to your Netlify dashboard under Site Settings > Environment Variables:

```bash
OPENAI_API_KEY=your-openai-api-key
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key
```

### 2. Supabase Database Setup

Create these tables in your Supabase project:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  scans_used INTEGER DEFAULT 0,
  scans_limit INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scans table
CREATE TABLE scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  original_text TEXT,
  translated_text TEXT,
  source_language VARCHAR(10),
  target_language VARCHAR(10),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  stripe_payment_intent_id VARCHAR(255),
  amount INTEGER,
  currency VARCHAR(3),
  status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. API Keys Setup

#### OpenAI
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it as `OPENAI_API_KEY` in Netlify

#### Supabase
1. Create a project at [Supabase](https://supabase.com)
2. Go to Settings > API
3. Copy your URL and keys to Netlify environment variables

#### Stripe
1. Create account at [Stripe](https://stripe.com)
2. Go to Developers > API Keys
3. Copy publishable and secret keys to Netlify

## Deployment

This site auto-deploys from GitHub when connected to Netlify.

### Manual Deployment
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## File Structure

```
/
├── index.html              # Main application
├── netlify.toml           # Netlify configuration
├── package.json           # Dependencies
├── README.md              # This file
├── styles/                # CSS files
│   ├── global.css
│   ├── header.css
│   ├── hero.css
│   ├── how-it-works.css
│   ├── social-proof.css
│   ├── pricing.css
│   ├── footer.css
│   └── modal.css
├── js/                    # JavaScript files
│   ├── config.js
│   ├── utils.js
│   └── main.js
└── netlify/
    └── functions/         # Serverless functions
        ├── scan-menu.js
        └── create-payment.js
```

## Support

For support, email support@whatthemenu.com or visit our website.

## License

MIT License - see LICENSE file for details.