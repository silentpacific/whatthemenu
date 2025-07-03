# Changes Summary: OpenAI Prompt Modification and Supabase Integration

## Overview
Modified the menu scanning system to:
1. Change OpenAI prompt to extract ONLY dish names (no descriptions)
2. Query Supabase dishes table to retrieve descriptions for each dish
3. Update results.html to display descriptions from Supabase

## Files Modified

### 1. `netlify/functions/scan-menu.js`
**Changes:**
- **Line 125**: Updated system prompt from "extracts structured menu data" to "extracts only dish names"
- **Line 130**: Updated user prompt to explicitly request "ONLY dish names" and exclude descriptions, prices, and other information
- **Lines 150-175**: Added new section to query Supabase dishes table for each dish name and enrich the data with descriptions
- **Line 185**: Updated to store enriched sections (with descriptions) instead of raw parsed sections
- **Line 195**: Updated return statement to use enriched sections

**New Flow:**
1. OpenAI extracts only dish names from image
2. For each dish name, query Supabase dishes table for description
3. Return enriched data with dish names + descriptions from database

### 2. `results.html`
**Changes:**
- **Line 850**: Updated dish description display to prioritize `dish.description` (from Supabase) over other fields
- **Line 870**: Updated dish explanation display to prioritize `dish.description` (from Supabase)
- **Line 920**: Modified renderMenu function to immediately display descriptions from Supabase
- **Line 930**: Updated setupDishClickHandlers to toggle visibility for existing descriptions and only call API for missing descriptions

**New Behavior:**
- Descriptions from Supabase are displayed immediately when results load
- Clicking on dish names with existing descriptions toggles visibility
- Only dishes without descriptions trigger additional API calls

### 3. `netlify/functions/test-scan-changes.js` (NEW)
**Purpose:** Test function to verify the new flow works correctly
- Tests Supabase dishes table connectivity
- Simulates the enrichment process with sample dish names
- Returns test results for verification

### 4. `netlify/functions/populate-dishes.js` (NEW)
**Purpose:** Populate dishes table with sample data for testing
- Adds 8 common dishes with descriptions
- Can be called to populate test data in Supabase

## Database Schema
The system uses the existing `dishes` table in Supabase with the following structure:
```sql
CREATE TABLE dishes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    explanation TEXT,
    language VARCHAR(10) DEFAULT 'en',
    scan_id UUID,
    user_id UUID,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Benefits of Changes

1. **Reduced OpenAI API Costs**: Only extracts dish names, not full descriptions
2. **Faster Processing**: No need to generate descriptions for every dish
3. **Consistent Descriptions**: Uses pre-approved, consistent descriptions from database
4. **Better Performance**: Descriptions load immediately from database
5. **Scalability**: Can easily add more dishes to database without API calls

## Testing

To test the changes:

1. **Populate test data:**
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/populate-dishes
   ```

2. **Test the enrichment process:**
   ```bash
   curl -X POST https://your-site.netlify.app/.netlify/functions/test-scan-changes
   ```

3. **Scan a menu image** and verify that:
   - Only dish names are extracted by OpenAI
   - Descriptions are retrieved from Supabase
   - Results page displays descriptions immediately

## Backward Compatibility
The changes maintain backward compatibility:
- Existing dish explanation functionality still works
- Fallback to "No description available" if dish not found in database
- Existing API endpoints remain unchanged

## Environment Variables Required
Ensure these environment variables are set in Netlify:
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` 