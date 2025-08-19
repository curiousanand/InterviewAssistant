/**
 * Date formatting and manipulation utilities
 */
const DateUtils = {
    /**
     * Format date for display
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        
        if (isNaN(dateObj.getTime())) {
            return 'Invalid date';
        }

        const now = new Date();
        const diffInMs = now - dateObj;
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) {
            return 'Just now';
        } else if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
        } else if (diffInDays < 7) {
            return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
        } else {
            return dateObj.toLocaleDateString();
        }
    },

    /**
     * Format date as ISO string
     * @param {Date} date - Date to format
     * @returns {string} ISO string
     */
    toISOString(date = new Date()) {
        return date.toISOString();
    },

    /**
     * Check if date is today
     * @param {string|Date} date - Date to check
     * @returns {boolean} True if date is today
     */
    isToday(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const today = new Date();
        
        return dateObj.toDateString() === today.toDateString();
    },

    /**
     * Check if date is this week
     * @param {string|Date} date - Date to check
     * @returns {boolean} True if date is this week
     */
    isThisWeek(date) {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        
        return dateObj >= startOfWeek && dateObj <= endOfWeek;
    },

    /**
     * Get human-readable time ago string
     * @param {string|Date} date - Date to format
     * @returns {string} Human-readable string
     */
    timeAgo(date) {
        return this.formatDate(date);
    }
};