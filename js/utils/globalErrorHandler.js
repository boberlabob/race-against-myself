/**
 * GlobalErrorHandler - Comprehensive error management system
 * Handles unhandled promises, JavaScript errors, and service worker issues
 */
import { DOMUtils } from './domUtils.js';

export class GlobalErrorHandler {
    constructor() {
        this.setupGlobalHandlers();
        this.errorQueue = [];
        this.maxErrors = 10;
        this.isInitialized = false;
    }
    
    /**
     * Initialize global error handlers
     */
    setupGlobalHandlers() {
        if (this.isInitialized) return;
        
        // Unhandled Promise Rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
            this.handleError('promise_rejection', event.reason, event);
            event.preventDefault(); // Prevent console error spam
        });
        
        // JavaScript Runtime Errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript Error:', event.error);
            this.handleError('javascript_error', event.error, event);
        });
        
        // Service Worker Errors
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('error', (event) => {
                console.error('Service Worker Error:', event);
                this.handleError('service_worker', event, event);
            });
        }
        
        // Resource loading errors (images, scripts, etc.)
        window.addEventListener('error', (event) => {
            if (event.target !== window && event.target.tagName) {
                console.warn('Resource loading error:', event.target.src || event.target.href);
                this.handleError('resource_error', {
                    message: `Failed to load ${event.target.tagName}: ${event.target.src || event.target.href}`,
                    element: event.target.tagName
                }, event);
            }
        }, true); // Use capture phase
        
        this.isInitialized = true;
        console.log('🛡️ Global Error Handler initialized');
    }
    
    /**
     * Central error handling method
     * @param {string} type - Error type
     * @param {Error|Object} error - Error object or data
     * @param {Event} originalEvent - Original event object
     */
    handleError(type, error, originalEvent) {
        const errorData = {
            type,
            message: error?.message || String(error) || 'Unknown error',
            stack: error?.stack || 'No stack trace available',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            elementInfo: originalEvent?.target ? {
                tagName: originalEvent.target.tagName,
                src: originalEvent.target.src,
                href: originalEvent.target.href
            } : null
        };
        
        // Add to error queue
        this.errorQueue.push(errorData);
        if (this.errorQueue.length > this.maxErrors) {
            this.errorQueue.shift(); // Remove oldest error
        }
        
        // Show user-friendly error based on type
        this.showUserError(type, error, errorData);
        
        // Store error locally for debugging
        this.reportError(errorData);
    }
    
    /**
     * Shows user-friendly error messages
     * @param {string} type - Error type
     * @param {Error} error - Original error
     * @param {Object} errorData - Processed error data
     */
    showUserError(type, error, errorData) {
        const errorMessages = {
            promise_rejection: {
                title: 'App-Problem',
                message: 'Ein interner Fehler ist aufgetreten. Die App sollte weiterhin funktionieren.',
                severity: 'warning'
            },
            javascript_error: {
                title: 'Unerwarteter Fehler',
                message: 'Ein unerwarteter Fehler ist aufgetreten. Seite neu laden?',
                severity: 'error',
                showReload: true
            },
            service_worker: {
                title: 'Offline-Problem',
                message: 'Offline-Funktionen sind temporär nicht verfügbar.',
                severity: 'warning'
            },
            resource_error: {
                title: 'Ladefehler',
                message: 'Eine Ressource konnte nicht geladen werden. Prüfe deine Internetverbindung.',
                severity: 'warning'
            }
        };
        
        const errorInfo = errorMessages[type] || {
            title: 'Unbekannter Fehler',
            message: 'Ein unbekannter Fehler ist aufgetreten.',
            severity: 'warning'
        };
        
        // Don't show errors for certain common issues
        if (this.shouldIgnoreError(error, type)) {
            return;
        }
        
        // Show non-intrusive error notification
        this.showErrorNotification(errorInfo);
        
        // For critical errors, suggest page reload
        if (errorInfo.showReload && errorInfo.severity === 'error') {
            setTimeout(() => {
                if (confirm(`${errorInfo.message}\n\nDie App wurde neu geladen um das Problem zu beheben. OK?`)) {
                    window.location.reload();
                }
            }, 3000);
        }
    }
    
    /**
     * Check if error should be ignored (too common/not user-relevant)
     * @param {Error} error - Error object
     * @param {string} type - Error type
     * @returns {boolean} - True if error should be ignored
     */
    shouldIgnoreError(error, type) {
        const message = error?.message || String(error);
        
        // Ignore common browser extension errors
        if (message.includes('extension://') || message.includes('chrome-extension://')) {
            return true;
        }
        
        // Ignore network errors in development
        if (message.includes('Failed to fetch') && window.location.hostname === 'localhost') {
            return true;
        }
        
        // Ignore script loading errors for optional resources
        if (type === 'resource_error' && message.includes('chart.js')) {
            console.warn('Charts will be disabled due to CDN load failure');
            return true; // Charts are optional
        }
        
        return false;
    }
    
    /**
     * Shows a non-intrusive error notification
     * @param {Object} errorInfo - Error information object
     */
    showErrorNotification(errorInfo) {
        // Check if notification already exists
        const existingNotification = document.querySelector('.error-notification');
        if (existingNotification) {
            return; // Don't spam notifications
        }
        
        const notification = DOMUtils.createElement('div', { 
            class: `error-notification error-${errorInfo.severity}`,
            style: 'position: fixed; top: 20px; right: 20px; z-index: 9999; max-width: 300px;'
        });
        
        const title = DOMUtils.createElement('div', { class: 'notification-title' }, errorInfo.title);
        const message = DOMUtils.createElement('div', { class: 'notification-message' }, errorInfo.message);
        const closeBtn = DOMUtils.createButton('×', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, { class: 'notification-close' });
        
        notification.appendChild(closeBtn);
        notification.appendChild(title);
        notification.appendChild(message);
        
        document.body.appendChild(notification);
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 8000);
    }
    
    /**
     * Stores error data locally for debugging
     * @param {Object} errorData - Error data to store
     */
    reportError(errorData) {
        try {
            const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
            errors.push(errorData);
            
            // Keep only last 20 errors to prevent localStorage bloat
            if (errors.length > 20) {
                errors.splice(0, errors.length - 20);
            }
            
            localStorage.setItem('app_errors', JSON.stringify(errors));
        } catch (e) {
            console.warn('Could not store error data:', e);
        }
    }
    
    /**
     * Gets error report for debugging
     * @returns {Object} Complete error report
     */
    getErrorReport() {
        return {
            recentErrors: this.errorQueue,
            storedErrors: JSON.parse(localStorage.getItem('app_errors') || '[]'),
            appVersion: '1.0.0',
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            performance: this.getPerformanceInfo()
        };
    }
    
    /**
     * Gets basic performance information
     * @returns {Object} Performance data
     */
    getPerformanceInfo() {
        if (!window.performance) return null;
        
        return {
            loadTime: window.performance.timing.loadEventEnd - window.performance.timing.navigationStart,
            domReady: window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart,
            memoryUsage: window.performance.memory ? {
                used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024)
            } : null
        };
    }
    
    /**
     * Clears stored error data
     */
    clearErrorData() {
        localStorage.removeItem('app_errors');
        this.errorQueue = [];
        console.log('🧹 Error data cleared');
    }
    
    /**
     * Shows debug information for development
     */
    showDebugInfo() {
        const report = this.getErrorReport();
        console.table(report.recentErrors);
        console.log('Full Error Report:', report);
        return report;
    }
}

// Auto-initialize if not already done
if (!window.globalErrorHandler) {
    window.globalErrorHandler = new GlobalErrorHandler();
}