/**
 * DOM manipulation utilities
 */
const DOMUtils = {
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} Element or null
     */
    getElementById(id) {
        return document.getElementById(id);
    },

    /**
     * Safely get element by selector
     * @param {string} selector - CSS selector
     * @returns {HTMLElement|null} Element or null
     */
    querySelector(selector) {
        return document.querySelector(selector);
    },

    /**
     * Get all elements by selector
     * @param {string} selector - CSS selector
     * @returns {NodeList} Elements matching selector
     */
    querySelectorAll(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * Create element with attributes and content
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Element attributes
     * @param {string} content - Text content
     * @returns {HTMLElement} Created element
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });

        if (content) {
            element.textContent = content;
        }

        return element;
    },

    /**
     * Add event listener with optional delegation
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @param {string} delegate - Optional delegation selector
     */
    addEventListener(target, event, handler, delegate = null) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        
        if (!element) return;

        if (delegate) {
            element.addEventListener(event, (e) => {
                const delegatedTarget = e.target.closest(delegate);
                if (delegatedTarget) {
                    handler.call(delegatedTarget, e);
                }
            });
        } else {
            element.addEventListener(event, handler);
        }
    },

    /**
     * Add CSS class to element
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} className - CSS class name
     */
    addClass(target, className) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        if (element) {
            element.classList.add(className);
        }
    },

    /**
     * Remove CSS class from element
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} className - CSS class name
     */
    removeClass(target, className) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        if (element) {
            element.classList.remove(className);
        }
    },

    /**
     * Toggle CSS class on element
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} className - CSS class name
     * @returns {boolean} True if class was added, false if removed
     */
    toggleClass(target, className) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        if (element) {
            return element.classList.toggle(className);
        }
        return false;
    },

    /**
     * Show element by removing 'hidden' class
     * @param {HTMLElement|string} target - Element or selector
     */
    show(target) {
        this.removeClass(target, 'hidden');
    },

    /**
     * Hide element by adding 'hidden' class
     * @param {HTMLElement|string} target - Element or selector
     */
    hide(target) {
        this.addClass(target, 'hidden');
    },

    /**
     * Empty element content
     * @param {HTMLElement|string} target - Element or selector
     */
    empty(target) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        if (element) {
            element.innerHTML = '';
        }
    },

    /**
     * Escape HTML to prevent XSS
     * @param {string} html - HTML string to escape
     * @returns {string} Escaped HTML
     */
    escapeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },

    /**
     * Animate element with CSS class
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} animationClass - Animation CSS class
     * @param {number} duration - Animation duration in ms
     * @returns {Promise} Promise that resolves when animation completes
     */
    animate(target, animationClass, duration = 300) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        
        return new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }

            element.classList.add(animationClass);
            
            setTimeout(() => {
                element.classList.remove(animationClass);
                resolve();
            }, duration);
        });
    },

    /**
     * Focus element safely
     * @param {HTMLElement|string} target - Element or selector
     */
    focus(target) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        if (element && element.focus) {
            element.focus();
        }
    },

    /**
     * Check if element has specific class
     * @param {HTMLElement|string} target - Element or selector
     * @param {string} className - CSS class to check
     * @returns {boolean} True if element has class
     */
    hasClass(target, className) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        return element ? element.classList.contains(className) : false;
    },

    /**
     * Set multiple attributes on element
     * @param {HTMLElement|string} target - Element or selector
     * @param {Object} attributes - Attributes object
     */
    setAttributes(target, attributes) {
        const element = typeof target === 'string' ? this.querySelector(target) : target;
        if (element) {
            Object.entries(attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
    },

    /**
     * Create debounced function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
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
};