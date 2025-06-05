/**
 * Utility functions for Grade Sheet Analyzer
 */

class Utils {
    /**
     * Format file size in human readable format
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Validate file type and size
     */
    static validateFile(file) {
        const errors = [];
        
        // Check file type
        if (!CONFIG.PDF.SUPPORTED_TYPES.includes(file.type)) {
            errors.push('Please select a PDF file.');
        }
        
        // Check file size
        const maxSizeBytes = CONFIG.PDF.MAX_FILE_SIZE_MB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            errors.push(`File size should be less than ${CONFIG.PDF.MAX_FILE_SIZE_MB}MB. Current size: ${Utils.formatFileSize(file.size)}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Debounce function to limit function calls
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Create a smooth scroll to element
     */
    static scrollToElement(elementId, offset = 0) {
        const element = document.getElementById(elementId);
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: CONFIG.UI.SCROLL_BEHAVIOR
            });
        }
    }
    
    /**
     * Generate a unique ID
     */
    static generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Safe console logging that respects debug settings
     */
    static log(message, data = null) {
        if (CONFIG.DEBUG.ENABLE_CONSOLE_LOGS) {
            if (data) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
    }
    
    /**
     * Performance logging wrapper
     */
    static performanceLog(label, fn) {
        if (CONFIG.DEBUG.ENABLE_PERFORMANCE_LOGGING) {
            console.time(label);
            const result = fn();
            console.timeEnd(label);
            return result;
        } else {
            return fn();
        }
    }
    
    /**
     * Format number with specified decimal places
     */
    static formatNumber(number, decimals = 2) {
        return parseFloat(number).toFixed(decimals);
    }
    
    /**
     * Calculate percentage
     */
    static calculatePercentage(value, total) {
        if (total === 0) return 0;
        return (value / total) * 100;
    }
    
    /**
     * Create a DOM element with attributes and children
     */
    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'innerHTML') {
                element.innerHTML = attributes[key];
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        
        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    }
    
    /**
     * Show toast notification
     */
    static showToast(message, type = 'info', duration = 3000) {
        const toast = Utils.createElement('div', {
            className: `toast toast-${type}`,
            innerHTML: message
        });
        
        // Add to body
        document.body.appendChild(toast);
        
        // Show with animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
        
        return toast;
    }
    
    /**
     * Copy text to clipboard
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('✅ Copied to clipboard!', 'success');
            return true;
        } catch (err) {
            Utils.log('Failed to copy text to clipboard', err);
            Utils.showToast('❌ Failed to copy to clipboard', 'error');
            return false;
        }
    }
    
    /**
     * Download data as file
     */
    static downloadAsFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
