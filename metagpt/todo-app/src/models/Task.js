/**
 * Task model class representing a todo item
 * Encapsulates task data and validation logic
 */
class Task {
    constructor(text, id = null) {
        this.id = id || this.generateId();
        this.text = this.validateText(text);
        this.completed = false;
        this.createdAt = new Date().toISOString();
        this.updatedAt = this.createdAt;
    }

    /**
     * Generate unique ID for the task
     * @returns {string} Unique identifier
     */
    generateId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Validate task text
     * @param {string} text - Task description
     * @returns {string} Validated text
     * @throws {Error} If text is invalid
     */
    validateText(text) {
        if (!text || typeof text !== 'string') {
            throw new Error('Task text must be a non-empty string');
        }
        
        const trimmed = text.trim();
        if (trimmed.length === 0) {
            throw new Error('Task text cannot be empty');
        }
        
        if (trimmed.length > 500) {
            throw new Error('Task text cannot exceed 500 characters');
        }
        
        return trimmed;
    }

    /**
     * Toggle completion status
     */
    toggle() {
        this.completed = !this.completed;
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Update task text
     * @param {string} newText - New task description
     */
    updateText(newText) {
        this.text = this.validateText(newText);
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Convert task to JSON for storage
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            text: this.text,
            completed: this.completed,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Create task from JSON data
     * @param {Object} data - JSON data
     * @returns {Task} Task instance
     */
    static fromJSON(data) {
        const task = new Task(data.text, data.id);
        task.completed = Boolean(data.completed);
        task.createdAt = data.createdAt || new Date().toISOString();
        task.updatedAt = data.updatedAt || data.createdAt || new Date().toISOString();
        return task;
    }
}