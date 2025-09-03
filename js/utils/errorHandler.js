/**
 * GPSErrorHandler - User-friendly GPS error handling
 * Provides actionable error messages and recovery options for GPS issues
 */
import { DOMUtils } from './domUtils.js';

export class GPSErrorHandler {
    /**
     * Gets user-friendly error message and actions for GPS errors
     * @param {GeolocationPositionError} error - GPS error object
     * @param {string} context - Context where error occurred
     * @returns {Object} Error information with title, message, and action
     */
    static getErrorMessage(error, context = 'general') {
        const baseMessages = {
            [error.PERMISSION_DENIED]: {
                title: 'GPS-Zugriff verweigert',
                message: 'Bitte erlaube der App den Zugriff auf deinen Standort in den Browser-Einstellungen.',
                action: 'Einstellungen öffnen',
                actionCallback: () => this.showLocationSettings()
            },
            [error.POSITION_UNAVAILABLE]: {
                title: 'GPS-Signal nicht verfügbar',
                message: 'Gehe nach draußen oder an ein Fenster für besseren GPS-Empfang.',
                action: 'Erneut versuchen',
                actionCallback: () => this.retryGPS()
            },
            [error.TIMEOUT]: {
                title: 'GPS-Suche dauert zu lange',
                message: 'Überprüfe deine Internetverbindung und GPS-Einstellungen.',
                action: 'Wiederholen',
                actionCallback: () => this.retryGPS()
            }
        };
        
        return baseMessages[error.code] || {
            title: 'GPS-Problem',
            message: 'Ein unbekannter GPS-Fehler ist aufgetreten.',
            action: 'Support kontaktieren',
            actionCallback: () => this.showSupport()
        };
    }
    
    /**
     * Shows user-friendly error message with action button
     * @param {GeolocationPositionError} error - GPS error object
     * @param {string} containerId - ID of container to show error in
     */
    static showUserFriendlyError(error, containerId = 'error-container') {
        const errorInfo = this.getErrorMessage(error);
        let container = document.getElementById(containerId);
        
        // Create container if it doesn't exist
        if (!container) {
            container = DOMUtils.createElement('div', { 
                id: containerId,
                class: 'error-container'
            });
            document.querySelector('.main-content').appendChild(container);
        }
        
        DOMUtils.clearContent(container); // Clear previous errors
        
        const errorCard = DOMUtils.createElement('div', { class: 'error-card' });
        const titleEl = DOMUtils.createElement('h3', { class: 'error-title' }, errorInfo.title);
        const messageEl = DOMUtils.createElement('p', { class: 'error-message' }, errorInfo.message);
        const actionBtn = DOMUtils.createButton(errorInfo.action, errorInfo.actionCallback, { 
            class: 'error-action' 
        });
        
        errorCard.appendChild(titleEl);
        errorCard.appendChild(messageEl);
        errorCard.appendChild(actionBtn);
        container.appendChild(errorCard);
        container.style.display = 'block';
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (container && container.parentNode) {
                container.style.display = 'none';
            }
        }, 30000);
    }
    
    /**
     * Shows location settings help
     */
    static showLocationSettings() {
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isFirefox = /Firefox/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
        
        let instructions = 'Öffne die Browser-Einstellungen und erlaube den Standortzugriff für diese Website.';
        
        if (isChrome) {
            instructions = 'Chrome: Klicke auf das Schloss-Symbol in der Adressleiste → "Standort" → "Zulassen"';
        } else if (isFirefox) {
            instructions = 'Firefox: Klicke auf das Schild-Symbol in der Adressleiste → "Berechtigung ändern"';
        } else if (isSafari) {
            instructions = 'Safari: Menü → "Einstellungen" → "Websites" → "Standort"';
        }
        
        alert(`GPS-Berechtigung aktivieren:\n\n${instructions}\n\nLade danach die Seite neu.`);
    }
    
    /**
     * Triggers GPS retry
     */
    static retryGPS() {
        // Hide error container
        const container = document.getElementById('error-container');
        if (container) {
            container.style.display = 'none';
        }
        
        // Trigger a custom event that the main app can listen to
        window.dispatchEvent(new CustomEvent('gps-retry-requested'));
    }
    
    /**
     * Shows support information
     */
    static showSupport() {
        const supportInfo = `
GPS-Problem melden:

• Gerät: ${navigator.platform}
• Browser: ${navigator.userAgent.split(' ').slice(-2).join(' ')}
• Fehlerzeit: ${new Date().toLocaleString('de-DE')}

Häufige Lösungen:
1. GPS in den Handy-Einstellungen aktivieren
2. Browser-Berechtigung für Standort prüfen
3. Im Freien oder am Fenster versuchen
4. Seite neu laden (F5)
5. Browser-Cache leeren

Funktioniert immer noch nicht? Beschreibe das Problem und sende diese Informationen an den Entwickler.
        `;
        
        if (navigator.share) {
            navigator.share({
                title: 'GPS-Problem melden',
                text: supportInfo
            });
        } else {
            // Fallback: Copy to clipboard or show in alert
            if (navigator.clipboard) {
                navigator.clipboard.writeText(supportInfo).then(() => {
                    alert('Problem-Informationen in die Zwischenablage kopiert.');
                });
            } else {
                alert(supportInfo);
            }
        }
    }
    
    /**
     * Hides all error messages
     */
    static hideErrors() {
        const container = document.getElementById('error-container');
        if (container) {
            container.style.display = 'none';
        }
    }
    
    /**
     * Shows a brief success message when GPS is working
     */
    static showGPSSuccess() {
        const container = document.getElementById('error-container');
        if (container) {
            DOMUtils.clearContent(container);
            
            const successCard = DOMUtils.createElement('div', { 
                class: 'success-card' 
            });
            const message = DOMUtils.createElement('p', {}, '✅ GPS-Signal gefunden!');
            successCard.appendChild(message);
            container.appendChild(successCard);
            container.style.display = 'block';
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
                if (container) {
                    container.style.display = 'none';
                }
            }, 3000);
        }
    }
}