# Tesseract.js Implementation Guide

## Overview
Replaced OpenAI API with Tesseract.js for free, client-side OCR processing. This eliminates API costs and timeout issues.

## What Changed

### 1. **New Files Created**
- `js/tesseract-scanner.js` - Tesseract.js wrapper class
- `test-tesseract.html` - Test page for OCR functionality
- `netlify/functions/scan-menu-tesseract.js` - Server-side backup (optional)

### 2. **Files Modified**
- `index.html` - Added Tesseract.js scripts
- `scan.html` - Added Tesseract.js scripts
- `js/main.js` - Updated to use Tesseract.js instead of OpenAI API

## How It Works

### Client-Side OCR Processing
1. **User uploads image** → Tesseract.js processes it in the browser
2. **Text extraction** → Raw text is extracted from the image
3. **Menu parsing** → Text is parsed into sections and dishes
4. **Supabase lookup** → Descriptions are retrieved from database
5. **Results display** → Menu with descriptions is shown

### Key Benefits
- ✅ **Completely Free** - No API costs
- ✅ **No Timeouts** - Runs in browser, no server limits
- ✅ **Privacy** - Images stay on user's device
- ✅ **Offline Capable** - Works without internet after initial load
- ✅ **No Rate Limits** - Unlimited usage

## Usage

### Testing
1. Open `test-tesseract.html` in your browser
2. Upload a menu image
3. See OCR results and parsed sections

### Production
1. Upload image on main site
2. Tesseract.js processes the image
3. Results are enriched with Supabase descriptions
4. User sees complete menu with descriptions

## Technical Details

### TesseractScanner Class
```javascript
class TesseractScanner {
    async initialize() // Loads Tesseract.js
    async scanImage(file) // Processes image and returns text
    parseMenuText(text) // Converts text to menu sections
}
```

### Menu Parsing Logic
- Detects section headers (APPETIZERS, MAIN, etc.)
- Filters out prices and numbers
- Groups dishes under sections
- Handles various menu formats

### Integration with Supabase
- Queries `dishes` table for descriptions
- Enriches OCR results with database data
- Stores scan history in `menu_scans` table

## Performance Considerations

### Pros
- No server processing time
- No API rate limits
- Works offline
- Free forever

### Cons
- Initial load time (~2MB for Tesseract.js)
- Less accurate than OpenAI for complex layouts
- Processing happens on user's device
- May be slower on mobile devices

## Browser Compatibility
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Mobile browsers (may be slower)

## Fallback Options
If Tesseract.js doesn't work well enough, you can easily switch back to:
1. **OCR.space API** - 500 requests/day free
2. **Google Cloud Vision** - 1000 images/month free
3. **Azure Computer Vision** - 5000 transactions/month free

## Testing the Implementation

### Quick Test
1. Visit `test-tesseract.html`
2. Upload a menu image
3. Check OCR accuracy and parsing

### Full Flow Test
1. Go to main site
2. Upload menu image
3. Verify results page shows dishes with descriptions

## Troubleshooting

### Common Issues
1. **Tesseract.js not loading** - Check internet connection
2. **Poor OCR accuracy** - Try clearer images
3. **Slow processing** - Normal on first load, faster after

### Debug Mode
Add this to console to see detailed logs:
```javascript
localStorage.setItem('debug', 'true');
```

## Next Steps
1. Test with various menu images
2. Adjust parsing logic if needed
3. Consider adding language support
4. Optimize for mobile performance 