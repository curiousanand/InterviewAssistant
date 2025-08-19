/**
 * UUID and ID generation utilities
 */
const UUIDUtils = {
    /**
     * Generate a simple UUID-like string
     * @returns {string} UUID-like string
     */
    generate() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Generate a short ID for tasks
     * @returns {string} Short ID
     */
    generateShortId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${timestamp}-${random}`;
    },

    /**
     * Validate UUID format
     * @param {string} uuid - UUID to validate
     * @returns {boolean} True if valid UUID format
     */
    isValid(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    },

    /**
     * Generate timestamp-based ID
     * @returns {string} Timestamp ID
     */
    generateTimestampId() {
        return Date.now().toString() + Math.random().toString().substr(2);
    }
};