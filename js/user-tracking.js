// js/user-tracking.js - Enhanced user tracking system

class UserTracker {
    constructor() {
        this.storageKeys = {
            scans: 'lifetime_scans',
            fingerprint: 'user_fingerprint', 
            firstVisit: 'first_visit',
            userId: 'user_id'
        };
        this.maxFreeScans = 5;
    }

    /**
     * Generate browser fingerprint
     */
    async generateFingerprint() {
        try {
            const canvas = this.getCanvasFingerprint();
            const webgl = this.getWebGLFingerprint();
            
            const fingerprint = {
                userAgent: navigator.userAgent,
                language: navigator.language,
                languages: navigator.languages?.join(',') || '',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                doNotTrack: navigator.doNotTrack,
                canvas,
                webgl,
                timestamp: Date.now()
            };

            // Create hash of fingerprint
            const fingerprintString = JSON.stringify(fingerprint);
            const hash = await this.simpleHash(fingerprintString);
            
            return hash;
        } catch (error) {
            console.warn('Fingerprint generation failed:', error);
            return 'fallback_' + Date.now();
        }
    }

    /**
     * Simple hash function
     */
    async simpleHash(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    /**
     * Canvas fingerprinting
     */
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;
            
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('Menu Scanner 🍽️', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('What The Menu?', 4, 35);
            
            return canvas.toDataURL();
        } catch (error) {
            return 'canvas_unavailable';
        }
    }

    /**
     * WebGL fingerprinting
     */
    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return 'webgl_unavailable';
            
            const renderer = gl.getParameter(gl.RENDERER);
            const vendor = gl.getParameter(gl.VENDOR);
            
            return `${vendor}~${renderer}`;
        } catch (error) {
            return 'webgl_error';
        }
    }

    /**
     * Detect incognito/private browsing
     */
    async isIncognito() {
        return new Promise((resolve) => {
            // Test 1: localStorage quota
            try {
                localStorage.setItem('incognito_test', '1');
                localStorage.removeItem('incognito_test');
                
                // Test 2: Storage quota estimation
                if ('storage' in navigator && 'estimate' in navigator.storage) {
                    navigator.storage.estimate().then(({quota}) => {
                        // Incognito typically has much lower quota
                        resolve(quota < 120000000); // 120MB threshold
                    }).catch(() => resolve(false));
                } else {
                    resolve(false);
                }
            } catch (e) {
                // localStorage blocked = likely incognito
                resolve(true);
            }
        });
    }

    /**
     * Get user tracking data
     */
    async getUserData() {
        const fingerprint = await this.generateFingerprint();
        const isIncognito = await this.isIncognito();
        const scansUsed = this.getScansUsed();
        
        // Store fingerprint for consistency
        this.setStorageValue(this.storageKeys.fingerprint, fingerprint);
        
        // Track first visit
        if (!this.getStorageValue(this.storageKeys.firstVisit)) {
            this.setStorageValue(this.storageKeys.firstVisit, Date.now());
        }

        return {
            fingerprint,
            isIncognito,
            scansUsed,
            scansRemaining: Math.max(0, this.maxFreeScans - scansUsed),
            canScan: scansUsed < this.maxFreeScans,
            firstVisit: this.getStorageValue(this.storageKeys.firstVisit)
        };
    }

    /**
     * Get scans used from multiple storage methods
     */
    getScansUsed() {
        return parseInt(
            localStorage.getItem(this.storageKeys.scans) || 
            this.getCookie(this.storageKeys.scans) || 
            sessionStorage.getItem(this.storageKeys.scans) || 
            '0'
        );
    }

    /**
     * Increment scan count
     */
    incrementScanCount() {
        const currentScans = this.getScansUsed();
        const newCount = currentScans + 1;
        
        // Store in multiple places
        this.setStorageValue(this.storageKeys.scans, newCount);
        this.setCookie(this.storageKeys.scans, newCount, 365); // 1 year expiry
        sessionStorage.setItem(this.storageKeys.scans, newCount);
        
        return newCount;
    }

    /**
     * Check if user can scan
     */
    async canUserScan() {
        const userData = await this.getUserData();
        
        if (!userData.canScan) {
            this.showUpgradePrompt(userData);
            return false;
        }
        
        if (userData.isIncognito) {
            this.showIncognitoWarning();
        }
        
        return true;
    }

    /**
     * Show upgrade prompt
     */
    showUpgradePrompt(userData) {
        const message = `You've used all ${this.maxFreeScans} free scans! 
        
Upgrade to get unlimited menu translations:
• Daily Pass: $1 for 24 hours
• Weekly Pass: $5 for 7 days

Ready to keep exploring menus?`;

        if (confirm(message)) {
            // Redirect to pricing section
            document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Show incognito warning
     */
    showIncognitoWarning() {
        Utils.feedback.showToast(
            'Private browsing detected. Your free scans may reset when you close this window.',
            'warning'
        );
    }

    /**
     * Storage helpers
     */
    setStorageValue(key, value) {
        try {
            localStorage.setItem(key, value.toString());
        } catch (error) {
            console.warn('localStorage not available:', error);
        }
    }

    getStorageValue(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    /**
     * Cookie helpers
     */
    setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    /**
     * Update scan counter in UI
     */
    async updateScanCounterUI() {
        const userData = await this.getUserData();
        const scanCounter = document.querySelector('.scan-counter');
        
        if (scanCounter) {
            const scansUsedElement = scanCounter.querySelector('.scans-used');
            const scansLimitElement = scanCounter.querySelector('.scans-limit');
            
            if (scansUsedElement) scansUsedElement.textContent = userData.scansUsed;
            if (scansLimitElement) scansLimitElement.textContent = this.maxFreeScans;
        }
    }

    /**
     * Process a menu scan for free users
     */
    async processFreeUserScan() {
        if (!(await this.canUserScan())) {
            return false;
        }

        // Increment scan count
        this.incrementScanCount();
        
        // Update UI
        await this.updateScanCounterUI();
        
        return true;
    }
}

// Initialize user tracking
const userTracker = new UserTracker();

// Export for use in other files
if (typeof window !== 'undefined') {
    window.UserTracker = UserTracker;
    window.userTracker = userTracker;
}

// Update scan counter on page load
document.addEventListener('DOMContentLoaded', () => {
    userTracker.updateScanCounterUI();
});

console.log('🔍 Enhanced user tracking system loaded');