/**
 * Validation service for form inputs and data
 */
class ValidationService {
    constructor() {
        this.rules = {
            taskText: {
                required: true,
                minLength: 1,
                maxLength: 500,
                pattern: null // Can be set to regex pattern if needed
            }
        };
    }

    /**
     * Validate task text input
     * @param {string} text - Text to validate
     * @returns {Object} Validation result
     */
    validateTaskText(text) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Check if text exists
        if (!text || typeof text !== 'string') {
            result.isValid = false;
            result.errors.push('Task text is required');
            return result;
        }

        const trimmed = text.trim();

        // Check if empty after trimming
        if (trimmed.length === 0) {
            result.isValid = false;
            result.errors.push('Task text cannot be empty');
            return result;
        }

        // Check minimum length
        if (trimmed.length < this.rules.taskText.minLength) {
            result.isValid = false;
            result.errors.push(`Task text must be at least ${this.rules.taskText.minLength} character(s)`);
        }

        // Check maximum length
        if (trimmed.length > this.rules.taskText.maxLength) {
            result.isValid = false;
            result.errors.push(`Task text cannot exceed ${this.rules.taskText.maxLength} characters`);
        }

        // Check for potentially harmful content
        if (this.containsHTML(trimmed)) {
            result.warnings.push('HTML content detected and will be escaped');
        }

        // Check for very long words that might break layout
        const words = trimmed.split(/\s+/);
        const longWords = words.filter(word => word.length > 50);
        if (longWords.length > 0) {
            result.warnings.push('Very long words detected that might affect display');
        }

        return result;
    }

    /**
     * Check if text contains HTML tags
     * @param {string} text - Text to check
     * @returns {boolean} True if HTML detected
     */
    containsHTML(text) {
        const htmlRegex = /<[^>]*>/;
        return htmlRegex.test(text);
    }

    /**
     * Sanitize text input
     * @param {string} text - Text to sanitize
     * @returns {string} Sanitized text
     */
    sanitizeText(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        return text
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/&/g, '&amp;')
            .replace(/\x00-\x1f\x7f-\x9f/g, ''); // Remove control characters
    }

    /**
     * Deep sanitize object for localStorage
     * @param {Object} obj - Object to sanitize
     * @returns {Object} Sanitized object
     */
    sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeText(value);
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Validate JSON string before parsing
     * @param {string} jsonString - JSON string to validate
     * @returns {Object} Validation result
     */
    validateJSON(jsonString) {
        const result = {
            isValid: true,
            errors: [],
            data: null
        };

        if (!jsonString || typeof jsonString !== 'string') {
            result.isValid = false;
            result.errors.push('JSON string is required');
            return result;
        }

        try {
            result.data = JSON.parse(jsonString);
        } catch (error) {
            result.isValid = false;
            result.errors.push(`Invalid JSON: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate filter type
     * @param {string} filter - Filter to validate
     * @returns {boolean} True if valid filter
     */
    validateFilter(filter) {
        const validFilters = ['all', 'active', 'completed'];
        return validFilters.includes(filter);
    }

    /**
     * Validate task ID format
     * @param {string} id - ID to validate
     * @returns {boolean} True if valid ID format
     */
    validateTaskId(id) {
        if (!id || typeof id !== 'string') {
            return false;
        }

        // Check for basic ID format (alphanumeric, hyphens, underscores)
        const idRegex = /^[a-zA-Z0-9_-]+$/;
        return idRegex.test(id) && id.length > 0 && id.length < 100;
    }

    /**
     * Validate import data structure
     * @param {Object} data - Data to validate
     * @returns {Object} Validation result
     */
    validateImportData(data) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!data || typeof data !== 'object') {
            result.isValid = false;
            result.errors.push('Invalid data format');
            return result;
        }

        if (!data.tasks || !Array.isArray(data.tasks)) {
            result.isValid = false;
            result.errors.push('Tasks array is required');
            return result;
        }

        // Validate each task
        data.tasks.forEach((task, index) => {
            if (!task.id || !task.text) {
                result.errors.push(`Task at index ${index} is missing required fields`);
                result.isValid = false;
            }

            const textValidation = this.validateTaskText(task.text);
            if (!textValidation.isValid) {
                result.errors.push(`Task at index ${index}: ${textValidation.errors.join(', ')}`);
                result.isValid = false;
            }
        });

        // Check for duplicate IDs
        const ids = data.tasks.map(task => task.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            result.warnings.push(`Duplicate task IDs found: ${duplicateIds.join(', ')}`);
        }

        return result;
    }

    /**
     * Get validation error message for display
     * @param {Object} validationResult - Result from validation
     * @returns {string} Error message
     */
    getErrorMessage(validationResult) {
        if (validationResult.isValid) {
            return '';
        }

        return validationResult.errors.join('. ');
    }

    /**
     * Get validation warning message for display
     * @param {Object} validationResult - Result from validation
     * @returns {string} Warning message
     */
    getWarningMessage(validationResult) {
        if (!validationResult.warnings || validationResult.warnings.length === 0) {
            return '';
        }

        return validationResult.warnings.join('. ');
    }

    /**
     * Set custom validation rules
     * @param {Object} newRules - New validation rules
     */
    setRules(newRules) {
        this.rules = { ...this.rules, ...newRules };
    }

    /**
     * Reset rules to default
     */
    resetRules() {
        this.rules = {
            taskText: {
                required: true,
                minLength: 1,
                maxLength: 500,
                pattern: null
            }
        };
    }
}