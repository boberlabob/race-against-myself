/**
 * DOMUtils - Secure DOM manipulation utilities
 * Prevents XSS vulnerabilities by sanitizing input and providing safe DOM methods
 */
export class DOMUtils {
    /**
     * Escapes HTML special characters to prevent XSS attacks
     * @param {string} unsafe - Unsafe string that may contain HTML
     * @returns {string} - HTML-escaped safe string
     */
    static escapeHTML(unsafe) {
        if (typeof unsafe !== 'string') {
            return String(unsafe);
        }
        
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Creates a DOM element safely with attributes and text content
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Object with attribute key-value pairs
     * @param {string} textContent - Safe text content (will be escaped)
     * @returns {HTMLElement} - Created DOM element
     */
    static createElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);
        
        // Set attributes safely
        Object.entries(attributes).forEach(([key, value]) => {
            // Validate attribute names to prevent injection
            if (this.isValidAttributeName(key)) {
                element.setAttribute(key, String(value));
            } else {
                console.warn('Invalid attribute name blocked:', key);
            }
        });
        
        // Set text content safely (automatically escaped)
        if (textContent) {
            element.textContent = String(textContent);
        }
        
        return element;
    }

    /**
     * Sets innerHTML safely by first escaping the content
     * Only use when you absolutely need HTML structure - prefer createElement
     * @param {HTMLElement} element - Target element
     * @param {string} htmlContent - HTML content to sanitize and insert
     */
    static setInnerHTMLSafe(element, htmlContent) {
        // For maximum security, we escape everything and only allow basic HTML
        const safeContent = this.escapeHTML(htmlContent);
        element.innerHTML = safeContent;
    }

    /**
     * Replaces element content with safe text and HTML structure
     * @param {HTMLElement} element - Target element
     * @param {string} template - Template string with placeholders
     * @param {Object} values - Values to safely insert (will be escaped)
     */
    static setContentSafe(element, template, values = {}) {
        let safeContent = template;
        
        // Replace placeholders with escaped values
        Object.entries(values).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`;
            const safeValue = this.escapeHTML(String(value));
            safeContent = safeContent.replace(new RegExp(placeholder, 'g'), safeValue);
        });
        
        element.innerHTML = safeContent;
    }

    /**
     * Creates a text node (always safe from XSS)
     * @param {string} text - Text content
     * @returns {Text} - Text node
     */
    static createTextNode(text) {
        return document.createTextNode(String(text));
    }

    /**
     * Appends multiple children to an element safely
     * @param {HTMLElement} parent - Parent element
     * @param {Array} children - Array of child elements or text
     */
    static appendChildren(parent, children) {
        children.forEach(child => {
            if (typeof child === 'string') {
                parent.appendChild(this.createTextNode(child));
            } else if (child instanceof Node) {
                parent.appendChild(child);
            } else {
                console.warn('Invalid child element:', child);
            }
        });
    }

    /**
     * Validates attribute names to prevent injection
     * @param {string} attributeName - Attribute name to validate
     * @returns {boolean} - True if valid
     */
    static isValidAttributeName(attributeName) {
        // Allow standard HTML attributes, data- attributes, aria- attributes
        const validPattern = /^(id|class|style|title|alt|src|href|type|name|value|placeholder|disabled|required|readonly|checked|selected|data-[\w-]+|aria-[\w-]+)$/i;
        return validPattern.test(attributeName);
    }

    /**
     * Clears element content safely
     * @param {HTMLElement} element - Element to clear
     */
    static clearContent(element) {
        // More efficient than innerHTML = ''
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    /**
     * Creates a button with safe event handling
     * @param {string} text - Button text
     * @param {Function} clickHandler - Click event handler
     * @param {Object} attributes - Additional attributes
     * @returns {HTMLButtonElement} - Button element
     */
    static createButton(text, clickHandler, attributes = {}) {
        const button = this.createElement('button', attributes, text);
        
        if (typeof clickHandler === 'function') {
            button.addEventListener('click', clickHandler);
        }
        
        return button;
    }

    /**
     * Creates a link with safe href validation
     * @param {string} text - Link text
     * @param {string} href - Link URL
     * @param {Object} attributes - Additional attributes
     * @returns {HTMLAnchorElement} - Link element
     */
    static createLink(text, href, attributes = {}) {
        // Validate href to prevent javascript: and data: URLs
        if (!this.isValidURL(href)) {
            console.warn('Invalid URL blocked:', href);
            href = '#';
        }
        
        return this.createElement('a', { ...attributes, href }, text);
    }

    /**
     * Validates URLs to prevent XSS through javascript: or data: schemes
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid
     */
    static isValidURL(url) {
        if (typeof url !== 'string') return false;
        
        // Allow relative URLs, http, https, mailto, tel
        const validProtocols = /^(https?:|mailto:|tel:|\/|#)/i;
        const invalidProtocols = /^(javascript:|data:|vbscript:)/i;
        
        return validProtocols.test(url) && !invalidProtocols.test(url);
    }

    /**
     * Sanitizes style attribute values
     * @param {string} styleValue - CSS style value
     * @returns {string} - Sanitized style value
     */
    static sanitizeStyle(styleValue) {
        if (typeof styleValue !== 'string') return '';
        
        // Remove potentially dangerous CSS
        return styleValue
            .replace(/javascript:/gi, '')
            .replace(/expression\(/gi, '')
            .replace(/behavior:/gi, '')
            .replace(/binding:/gi, '');
    }
}