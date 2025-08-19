/**
 * Application state management class
 * Handles the overall state of the todo application
 */
class AppState {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.isLoading = false;
        this.error = null;
        this.listeners = new Set();
    }

    /**
     * Add state change listener
     * @param {Function} listener - Callback function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of state change
     */
    notify() {
        this.listeners.forEach(listener => {
            try {
                listener(this.getState());
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Get current application state
     * @returns {Object} Current state
     */
    getState() {
        return {
            tasks: [...this.tasks],
            currentFilter: this.currentFilter,
            isLoading: this.isLoading,
            error: this.error,
            counts: this.getCounts()
        };
    }

    /**
     * Get task counts for different filters
     * @returns {Object} Task counts
     */
    getCounts() {
        const all = this.tasks.length;
        const completed = this.tasks.filter(task => task.completed).length;
        const active = all - completed;

        return { all, active, completed };
    }

    /**
     * Get filtered tasks based on current filter
     * @returns {Array} Filtered tasks
     */
    getFilteredTasks() {
        switch (this.currentFilter) {
            case 'active':
                return this.tasks.filter(task => !task.completed);
            case 'completed':
                return this.tasks.filter(task => task.completed);
            default:
                return this.tasks;
        }
    }

    /**
     * Set loading state
     * @param {boolean} loading - Loading status
     */
    setLoading(loading) {
        this.isLoading = Boolean(loading);
        this.notify();
    }

    /**
     * Set error state
     * @param {string|null} error - Error message or null
     */
    setError(error) {
        this.error = error;
        this.notify();
    }

    /**
     * Set current filter
     * @param {string} filter - Filter type ('all', 'active', 'completed')
     */
    setFilter(filter) {
        const validFilters = ['all', 'active', 'completed'];
        if (validFilters.includes(filter)) {
            this.currentFilter = filter;
            this.notify();
        }
    }

    /**
     * Set all tasks
     * @param {Array} tasks - Array of task objects
     */
    setTasks(tasks) {
        this.tasks = Array.isArray(tasks) ? tasks : [];
        this.notify();
    }

    /**
     * Add a new task
     * @param {Task} task - Task to add
     */
    addTask(task) {
        this.tasks.push(task);
        this.notify();
    }

    /**
     * Update existing task
     * @param {string} taskId - Task ID to update
     * @param {Object} updates - Updates to apply
     */
    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            Object.assign(this.tasks[taskIndex], updates);
            this.tasks[taskIndex].updatedAt = new Date().toISOString();
            this.notify();
        }
    }

    /**
     * Delete a task
     * @param {string} taskId - Task ID to delete
     */
    deleteTask(taskId) {
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        this.notify();
    }

    /**
     * Clear all completed tasks
     */
    clearCompleted() {
        this.tasks = this.tasks.filter(task => !task.completed);
        this.notify();
    }

    /**
     * Find task by ID
     * @param {string} taskId - Task ID
     * @returns {Task|undefined} Found task or undefined
     */
    findTask(taskId) {
        return this.tasks.find(task => task.id === taskId);
    }
}