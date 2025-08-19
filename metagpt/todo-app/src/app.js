/**
 * Todo App - Core JavaScript Functionality
 * Clean, focused implementation with modern practices and comprehensive comments
 */

class TodoApp {
    constructor() {
        // DOM element references - cache frequently used elements
        this.taskForm = document.getElementById('task-form');
        this.taskInput = document.getElementById('task-input');
        this.taskList = document.getElementById('task-list');
        this.emptyState = document.getElementById('empty-state');
        this.charCount = document.querySelector('.current-count');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.clearCompletedBtn = document.getElementById('clear-completed');
        this.bulkActions = document.querySelector('.bulk-actions');
        
        // Application state
        this.tasks = [];
        this.currentFilter = 'all';
        
        // Services
        this.storageService = new StorageService();
        this.validationService = new ValidationService();
        
        // Initialize the application
        this.init();
    }
    
    /**
     * Initialize the application
     * Sets up event listeners and loads existing tasks
     */
    async init() {
        try {
            // Validate storage integrity on startup
            const integrity = this.storageService.validateStorageIntegrity();
            if (!integrity.isValid && integrity.error !== 'localStorage not available') {
                console.warn('Storage integrity check failed:', integrity.error);
                this.showError('Data corruption detected. Some tasks may have been recovered from backup.');
            }

            await this.loadTasks();
            this.setupEventListeners();
            this.render();
            
            // Set up auto-save interval
            this.setupAutoSave();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize the application. Please refresh the page.');
        }
    }
    
    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Form submission for adding tasks
        this.taskForm.addEventListener('submit', (e) => this.handleAddTask(e));
        
        // Character count update
        this.taskInput.addEventListener('input', () => this.updateCharCount());
        
        // Filter buttons
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilterChange(e));
        });
        
        // Clear completed tasks
        this.clearCompletedBtn.addEventListener('click', () => this.clearCompletedTasks());
        
        // Task list event delegation for edit/delete/toggle
        this.taskList.addEventListener('click', (e) => this.handleTaskListClick(e));
        this.taskList.addEventListener('change', (e) => this.handleTaskListChange(e));
        this.taskList.addEventListener('keydown', (e) => this.handleTaskListKeydown(e));
    }
    
    /**
     * Add a new task
     * Core CRUD operation - CREATE
     * @param {Event} e - Form submit event
     */
    async handleAddTask(e) {
        e.preventDefault();
        
        const taskText = this.taskInput.value.trim();
        
        // Validate input using ValidationService
        const validation = this.validationService.validateTaskText(taskText);
        if (!validation.isValid) {
            this.showError(validation.errors[0]);
            return;
        }
        
        // Check for duplicate tasks
        if (this.isDuplicateTask(taskText)) {
            this.showError('This task already exists');
            return;
        }
        
        try {
            // Create new task using Task model
            const newTask = new Task(taskText);
            
            // Add to tasks array at the beginning
            this.tasks.unshift(newTask);
            this.markUnsavedChanges();
            
            // Clear input and update character count
            this.taskInput.value = '';
            this.updateCharCount();
            
            // Save to storage and re-render
            await this.saveTasks();
            this.render();
            
            // Focus back to input for better UX
            this.taskInput.focus();
            
            // Announce success to screen readers
            this.announceToScreenReader(`Task "${taskText}" added successfully`);
            
        } catch (error) {
            console.error('Failed to add task:', error);
            this.showError('Failed to add task. Please try again.');
        }
    }
    
    /**
     * Delete a task
     * Core CRUD operation - DELETE
     * @param {string} taskId - ID of task to delete
     */
    async deleteTask(taskId) {
        // Find task index in array
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        
        if (taskIndex === -1) {
            console.warn(`Task with ID ${taskId} not found`);
            this.showError('Task not found');
            return;
        }
        
        try {
            // Store reference to deleted task for confirmation message
            const deletedTask = this.tasks[taskIndex];
            
            // Remove task from array
            this.tasks.splice(taskIndex, 1);
            this.markUnsavedChanges();
            
            // Save to storage and re-render
            await this.saveTasks();
            this.render();
            
            // Announce successful deletion
            this.announceToScreenReader(`Task "${deletedTask.text}" deleted successfully`);
            
        } catch (error) {
            console.error('Failed to delete task:', error);
            this.showError('Failed to delete task. Please try again.');
        }
    }
    
    /**
     * Toggle task completion status
     * Core CRUD operation - UPDATE
     * @param {string} taskId - ID of task to toggle
     */
    async toggleTask(taskId) {
        // Find task in array
        const task = this.tasks.find(task => task.id === taskId);
        
        if (!task) {
            console.warn(`Task with ID ${taskId} not found`);
            this.showError('Task not found');
            return;
        }
        
        try {
            // Toggle completion status using Task model method
            task.toggle();
            this.markUnsavedChanges();
            
            // Save to storage and re-render
            await this.saveTasks();
            this.render();
            
            // Announce status change for screen readers
            const status = task.completed ? 'completed' : 'marked as active';
            this.announceToScreenReader(`Task "${task.text}" ${status}`);
            
        } catch (error) {
            console.error('Failed to toggle task:', error);
            this.showError('Failed to update task. Please try again.');
        }
    }
    
    /**
     * Update task text (inline editing)
     * Core CRUD operation - UPDATE
     * @param {string} taskId - ID of task to update
     * @param {string} newText - New text for the task
     * @returns {boolean} Success status
     */
    async updateTask(taskId, newText) {
        // Find task in array
        const task = this.tasks.find(task => task.id === taskId);
        
        if (!task) {
            console.warn(`Task with ID ${taskId} not found`);
            this.showError('Task not found');
            return false;
        }
        
        // Validate new text using ValidationService
        const validation = this.validationService.validateTaskText(newText);
        if (!validation.isValid) {
            this.showError(validation.errors[0]);
            return false;
        }
        
        // Check for duplicate tasks (excluding current task)
        if (this.isDuplicateTask(newText.trim(), taskId)) {
            this.showError('This task already exists');
            return false;
        }
        
        try {
            // Update task text using Task model method
            task.updateText(newText);
            this.markUnsavedChanges();
            
            // Save to storage and re-render
            await this.saveTasks();
            this.render();
            
            // Announce successful update
            this.announceToScreenReader(`Task updated to "${task.text}"`);
            return true;
            
        } catch (error) {
            console.error('Failed to update task:', error);
            this.showError('Failed to update task. Please try again.');
            return false;
        }
    }
    
    /**
     * Clear all completed tasks
     */
    clearCompletedTasks() {
        const completedCount = this.tasks.filter(task => task.completed).length;
        
        if (completedCount === 0) {
            return;
        }
        
        this.tasks = this.tasks.filter(task => !task.completed);
        this.markUnsavedChanges();
        
        this.saveTasks();
        this.render();
        
        this.announceToScreenReader(`${completedCount} completed task${completedCount > 1 ? 's' : ''} cleared`);
    }
    
    /**
     * Handle clicks on task list items
     * @param {Event} e - Click event
     */
    handleTaskListClick(e) {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        
        const taskId = taskItem.dataset.taskId;
        
        // Handle delete button click
        if (e.target.matches('.delete-btn')) {
            this.deleteTask(taskId);
            return;
        }
        
        // Handle edit button click
        if (e.target.matches('.edit-btn')) {
            this.enableTaskEditing(taskItem);
            return;
        }
        
        // Handle task text click (for editing)
        if (e.target.matches('.task-text')) {
            this.enableTaskEditing(taskItem);
            return;
        }
    }
    
    /**
     * Handle change events on task list (checkboxes)
     * @param {Event} e - Change event
     */
    handleTaskListChange(e) {
        if (e.target.matches('.task-checkbox')) {
            const taskItem = e.target.closest('.task-item');
            const taskId = taskItem.dataset.taskId;
            this.toggleTask(taskId);
        }
    }
    
    /**
     * Handle keydown events for accessibility and editing
     * @param {Event} e - Keydown event
     */
    handleTaskListKeydown(e) {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        
        const taskId = taskItem.dataset.taskId;
        
        // Handle Enter key on task text for editing
        if (e.key === 'Enter' && e.target.matches('.task-text')) {
            this.enableTaskEditing(taskItem);
            return;
        }
        
        // Handle Delete key for task deletion
        if (e.key === 'Delete' && e.target.matches('.task-text')) {
            this.deleteTask(taskId);
            return;
        }
        
        // Handle editing mode keys
        if (e.target.matches('.task-edit-input')) {
            if (e.key === 'Enter') {
                this.saveTaskEdit(taskItem);
            } else if (e.key === 'Escape') {
                this.cancelTaskEdit(taskItem);
            }
        }
    }
    
    /**
     * Enable inline editing for a task
     * @param {HTMLElement} taskItem - Task item element
     */
    enableTaskEditing(taskItem) {
        const taskText = taskItem.querySelector('.task-text');
        const currentText = taskText.textContent;
        
        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'task-edit-input';
        input.value = currentText;
        input.maxLength = 500;
        
        // Replace text with input
        taskText.style.display = 'none';
        taskItem.insertBefore(input, taskText.nextSibling);
        
        // Focus and select text
        input.focus();
        input.select();
        
        // Store original text for cancellation
        taskItem.dataset.originalText = currentText;
    }
    
    /**
     * Save task edit
     * @param {HTMLElement} taskItem - Task item element
     */
    saveTaskEdit(taskItem) {
        const input = taskItem.querySelector('.task-edit-input');
        const taskText = taskItem.querySelector('.task-text');
        const taskId = taskItem.dataset.taskId;
        
        if (this.updateTask(taskId, input.value)) {
            // Success - cleanup will happen in render()
        } else {
            // Validation failed - restore original text
            this.cancelTaskEdit(taskItem);
        }
    }
    
    /**
     * Cancel task edit
     * @param {HTMLElement} taskItem - Task item element
     */
    cancelTaskEdit(taskItem) {
        const input = taskItem.querySelector('.task-edit-input');
        const taskText = taskItem.querySelector('.task-text');
        
        // Remove input and show original text
        if (input) {
            input.remove();
        }
        taskText.style.display = '';
        
        // Clean up
        delete taskItem.dataset.originalText;
    }
    
    /**
     * Handle filter button changes
     * @param {Event} e - Click event
     */
    handleFilterChange(e) {
        const newFilter = e.target.dataset.filter;
        
        if (newFilter === this.currentFilter) {
            return;
        }
        
        // Update active button
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === newFilter);
            btn.setAttribute('aria-selected', btn.dataset.filter === newFilter);
        });
        
        this.currentFilter = newFilter;
        this.render();
    }
    
    /**
     * Input validation for task text
     * @param {string} text - Text to validate
     * @returns {boolean} - Whether text is valid
     */
    validateTaskInput(text) {
        // Check if empty
        if (!text || text.length === 0) {
            this.showError('Task cannot be empty');
            return false;
        }
        
        // Check length
        if (text.length > 500) {
            this.showError('Task cannot exceed 500 characters');
            return false;
        }
        
        // Check for duplicate tasks
        if (this.tasks.some(task => task.text.toLowerCase() === text.toLowerCase())) {
            this.showError('This task already exists');
            return false;
        }
        
        return true;
    }
    
    /**
     * Generate unique task ID
     * @returns {string} - Unique task ID
     */
    generateTaskId() {
        return `task-${Date.now()}-${this.taskIdCounter++}`;
    }
    
    /**
     * Update character count display
     */
    updateCharCount() {
        const currentLength = this.taskInput.value.length;
        this.charCount.textContent = currentLength;
        
        // Add warning class if approaching limit
        const charCountContainer = this.charCount.parentElement;
        charCountContainer.classList.toggle('warning', currentLength > 450);
        charCountContainer.classList.toggle('error', currentLength >= 500);
    }
    
    /**
     * Show error message to user
     * @param {string} message - Error message
     */
    showError(message) {
        // Simple error display - could be enhanced with toast notifications
        alert(message);
    }
    
    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        // Remove after announcement
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
    
    /**
     * Get filtered tasks based on current filter
     * @returns {Array} - Filtered tasks
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
     * Update task counts in filter buttons
     */
    updateTaskCounts() {
        const allCount = this.tasks.length;
        const activeCount = this.tasks.filter(task => !task.completed).length;
        const completedCount = this.tasks.filter(task => task.completed).length;
        
        document.querySelector('[data-count="all"]').textContent = allCount;
        document.querySelector('[data-count="active"]').textContent = activeCount;
        document.querySelector('[data-count="completed"]').textContent = completedCount;
        
        // Show/hide bulk actions
        this.bulkActions.classList.toggle('hidden', completedCount === 0);
    }
    
    /**
     * Render task list
     */
    renderTasks() {
        const filteredTasks = this.getFilteredTasks();
        
        // Clear existing tasks
        this.taskList.innerHTML = '';
        
        // Show empty state if no tasks
        if (filteredTasks.length === 0) {
            this.emptyState.classList.remove('hidden');
            return;
        }
        
        this.emptyState.classList.add('hidden');
        
        // Render each task
        filteredTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            this.taskList.appendChild(taskElement);
        });
    }
    
    /**
     * Create task element
     * @param {Object} task - Task object
     * @returns {HTMLElement} - Task element
     */
    createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.dataset.taskId = task.id;
        
        li.innerHTML = `
            <div class="task-content">
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    aria-label="Mark task as ${task.completed ? 'incomplete' : 'complete'}"
                >
                <span class="task-text" tabindex="0" role="button" aria-label="Click to edit task">
                    ${this.escapeHtml(task.text)}
                </span>
            </div>
            <div class="task-actions">
                <button 
                    type="button" 
                    class="edit-btn" 
                    aria-label="Edit task"
                    title="Edit task"
                >
                    ✏️
                </button>
                <button 
                    type="button" 
                    class="delete-btn" 
                    aria-label="Delete task"
                    title="Delete task"
                >
                    🗑️
                </button>
            </div>
        `;
        
        return li;
    }
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Save tasks to localStorage using StorageService
     */
    async saveTasks() {
        try {
            const success = await this.storageService.saveTasks(this.tasks);
            if (!success) {
                this.showError('Failed to save tasks. Storage may be full or unavailable.');
            }
        } catch (error) {
            console.error('Failed to save tasks:', error);
            this.showError('Failed to save tasks. Please try again.');
        }
    }
    
    /**
     * Load tasks from localStorage using StorageService
     */
    async loadTasks() {
        try {
            this.tasks = await this.storageService.loadTasks();
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.tasks = [];
            this.showError('Failed to load tasks. Starting with empty list.');
        }
    }

    /**
     * Setup auto-save functionality
     */
    setupAutoSave() {
        // Auto-save every 30 seconds if there are unsaved changes
        this.autoSaveInterval = setInterval(async () => {
            if (this.hasUnsavedChanges) {
                await this.saveTasks();
                this.hasUnsavedChanges = false;
            }
        }, 30000);

        // Save before page unload
        window.addEventListener('beforeunload', async (e) => {
            if (this.hasUnsavedChanges) {
                await this.saveTasks();
            }
        });

        // Handle visibility change (when tab becomes hidden/visible)
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden && this.hasUnsavedChanges) {
                await this.saveTasks();
                this.hasUnsavedChanges = false;
            }
        });
    }

    /**
     * Mark that there are unsaved changes
     */
    markUnsavedChanges() {
        this.hasUnsavedChanges = true;
    }
    
    /**
     * Main render method
     */
    render() {
        this.updateTaskCounts();
        this.renderTasks();
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
});

// Add CSS for screen reader only content
const style = document.createElement('style');
style.textContent = `
    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
    
    .task-edit-input {
        background: #fff;
        border: 2px solid #007bff;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: inherit;
        font-family: inherit;
        width: 100%;
        box-sizing: border-box;
    }
    
    .char-count.warning {
        color: #ff9800;
    }
    
    .char-count.error {
        color: #f44336;
    }
`;
document.head.appendChild(style);