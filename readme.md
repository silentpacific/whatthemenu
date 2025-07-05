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
- **OCR**: Google Cloud Vision API
- **Payments**: Stripe
- **Database**: Supabase
- **Hosting**: Netlify

## Setup Instructions

### 1. Environment Variables

Add these to your Netlify dashboard under Site Settings > Environment Variables:

```bash
# Required for OCR functionality
GOOGLE_VISION_API_KEY=your-google-vision-api-key
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id

# Alternative: Use service account credentials
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Required for database
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Required for payments
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
STRIPE_SECRET_KEY=your-stripe-secret-key

# Required for AI explanations
OPENAI_API_KEY=your-openai-api-key
```

### 2. Google Cloud Vision API Setup

#### Option A: API Key (Recommended for Netlify)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Cloud Vision API
4. Go to APIs & Services > Credentials
5. Create an API Key
6. Add it as `GOOGLE_VISION_API_KEY` in Netlify
7. Add your project ID as `GOOGLE_CLOUD_PROJECT_ID`

#### Option B: Service Account (For local development)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Go to APIs & Services > Credentials
3. Create a Service Account
4. Download the JSON key file
5. Add the file path as `GOOGLE_APPLICATION_CREDENTIALS`

### 3. Supabase Database Setup

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

-- Menu scans table
CREATE TABLE menu_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  tier VARCHAR(50) DEFAULT 'free',
  menu_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dishes table for explanations
CREATE TABLE dishes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  explanation TEXT,
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

### 4. API Keys Setup

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
        ├── scan-menu-simple.js
        ├── scan-menu-google.js
        ├── get-dish-explanation.js
        └── create-payment.js
```

## Troubleshooting

### OCR Not Working (502 Error)
1. Check that `GOOGLE_VISION_API_KEY` is set in Netlify environment variables
2. Verify your Google Cloud project has the Vision API enabled
3. Ensure your API key has the necessary permissions
4. Check Netlify function logs for detailed error messages

### Fallback Mode
If Google Vision API is not configured, the app will use a fallback OCR that returns sample menu items for testing purposes.

## Support

For support, email support@whatthemenu.com or visit our website.

## License

MIT License - see LICENSE file for details.