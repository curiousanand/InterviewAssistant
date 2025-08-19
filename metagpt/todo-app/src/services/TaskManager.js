/**
 * Task management service
 * Handles all task-related operations and coordinates with storage
 */
class TaskManager {
    constructor() {
        this.storageService = new StorageService();
        this.validationService = new ValidationService();
        this.appState = new AppState();
        this.autoSaveEnabled = true;
        this.autoSaveDelay = 1000; // 1 second delay for auto-save
        this.autoSaveTimeout = null;
    }

    /**
     * Initialize the task manager
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            this.appState.setLoading(true);
            this.appState.setError(null);

            const tasks = await this.storageService.loadTasks();
            this.appState.setTasks(tasks);

            console.log(`TaskManager initialized with ${tasks.length} tasks`);
        } catch (error) {
            console.error('Failed to initialize TaskManager:', error);
            this.appState.setError('Failed to load tasks');
        } finally {
            this.appState.setLoading(false);
        }
    }

    /**
     * Add a new task
     * @param {string} text - Task text
     * @returns {Promise<Task|null>} Created task or null if failed
     */
    async addTask(text) {
        try {
            // Validate input
            const validation = this.validationService.validateTaskText(text);
            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Create new task
            const task = new Task(text);
            this.appState.addTask(task);

            // Auto-save
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }

            console.log('Task added:', task.id);
            return task;
        } catch (error) {
            console.error('Failed to add task:', error);
            this.appState.setError(error.message);
            return null;
        }
    }

    /**
     * Update existing task
     * @param {string} taskId - Task ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<boolean>} Success status
     */
    async updateTask(taskId, updates) {
        try {
            const task = this.appState.findTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            // Validate text if it's being updated
            if (updates.text !== undefined) {
                const validation = this.validationService.validateTaskText(updates.text);
                if (!validation.isValid) {
                    throw new Error(validation.errors.join(', '));
                }
            }

            // Apply updates
            this.appState.updateTask(taskId, updates);

            // Auto-save
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }

            console.log('Task updated:', taskId);
            return true;
        } catch (error) {
            console.error('Failed to update task:', error);
            this.appState.setError(error.message);
            return false;
        }
    }

    /**
     * Toggle task completion status
     * @param {string} taskId - Task ID
     * @returns {Promise<boolean>} Success status
     */
    async toggleTask(taskId) {
        try {
            const task = this.appState.findTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            task.toggle();
            this.appState.updateTask(taskId, {
                completed: task.completed,
                updatedAt: task.updatedAt
            });

            // Auto-save
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }

            console.log('Task toggled:', taskId, 'completed:', task.completed);
            return true;
        } catch (error) {
            console.error('Failed to toggle task:', error);
            this.appState.setError(error.message);
            return false;
        }
    }

    /**
     * Delete a task
     * @param {string} taskId - Task ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteTask(taskId) {
        try {
            const task = this.appState.findTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            this.appState.deleteTask(taskId);

            // Auto-save
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }

            console.log('Task deleted:', taskId);
            return true;
        } catch (error) {
            console.error('Failed to delete task:', error);
            this.appState.setError(error.message);
            return false;
        }
    }

    /**
     * Clear all completed tasks
     * @returns {Promise<boolean>} Success status
     */
    async clearCompleted() {
        try {
            const completedCount = this.appState.tasks.filter(task => task.completed).length;
            
            if (completedCount === 0) {
                return true;
            }

            this.appState.clearCompleted();

            // Auto-save
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }

            console.log(`Cleared ${completedCount} completed tasks`);
            return true;
        } catch (error) {
            console.error('Failed to clear completed tasks:', error);
            this.appState.setError(error.message);
            return false;
        }
    }

    /**
     * Manually save tasks to storage
     * @returns {Promise<boolean>} Success status
     */
    async saveTasks() {
        try {
            const success = await this.storageService.saveTasks(this.appState.tasks);
            if (!success) {
                throw new Error('Failed to save tasks to storage');
            }

            this.appState.setError(null);
            return true;
        } catch (error) {
            console.error('Failed to save tasks:', error);
            this.appState.setError('Failed to save tasks');
            return false;
        }
    }

    /**
     * Schedule auto-save with debouncing
     */
    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        this.autoSaveTimeout = setTimeout(() => {
            this.saveTasks();
        }, this.autoSaveDelay);
    }

    /**
     * Export tasks as JSON
     * @returns {string|null} JSON string or null if failed
     */
    exportTasks() {
        try {
            return this.storageService.exportTasks(this.appState.tasks);
        } catch (error) {
            console.error('Failed to export tasks:', error);
            this.appState.setError('Failed to export tasks');
            return null;
        }
    }

    /**
     * Import tasks from JSON
     * @param {string} jsonData - JSON string
     * @returns {Promise<boolean>} Success status
     */
    async importTasks(jsonData) {
        try {
            const tasks = this.storageService.importTasks(jsonData);
            if (!tasks) {
                throw new Error('Invalid import data');
            }

            // Validate import data
            const validation = this.validationService.validateImportData({
                tasks: tasks.map(task => task.toJSON())
            });

            if (!validation.isValid) {
                throw new Error(validation.errors.join(', '));
            }

            // Replace current tasks
            this.appState.setTasks(tasks);

            // Save to storage
            await this.saveTasks();

            console.log(`Imported ${tasks.length} tasks`);
            return true;
        } catch (error) {
            console.error('Failed to import tasks:', error);
            this.appState.setError(`Import failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Get task statistics
     * @returns {Object} Task statistics
     */
    getStatistics() {
        const tasks = this.appState.tasks;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return {
            total: tasks.length,
            completed: tasks.filter(task => task.completed).length,
            active: tasks.filter(task => !task.completed).length,
            createdToday: tasks.filter(task => {
                const taskDate = new Date(task.createdAt);
                return taskDate >= today;
            }).length,
            completedToday: tasks.filter(task => {
                if (!task.completed) return false;
                const taskDate = new Date(task.updatedAt);
                return taskDate >= today;
            }).length
        };
    }

    /**
     * Search tasks by text
     * @param {string} query - Search query
     * @returns {Array} Matching tasks
     */
    searchTasks(query) {
        if (!query || typeof query !== 'string') {
            return this.appState.tasks;
        }

        const lowercaseQuery = query.toLowerCase();
        return this.appState.tasks.filter(task =>
            task.text.toLowerCase().includes(lowercaseQuery)
        );
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - State change listener
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        return this.appState.subscribe(listener);
    }

    /**
     * Get current application state
     * @returns {Object} Current state
     */
    getState() {
        return this.appState.getState();
    }

    /**
     * Set filter
     * @param {string} filter - Filter type
     */
    setFilter(filter) {
        this.appState.setFilter(filter);
    }

    /**
     * Set auto-save settings
     * @param {boolean} enabled - Enable auto-save
     * @param {number} delay - Auto-save delay in ms
     */
    setAutoSave(enabled, delay = 1000) {
        this.autoSaveEnabled = enabled;
        this.autoSaveDelay = delay;
    }
}