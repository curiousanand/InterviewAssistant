/**
 * Local storage service for persisting tasks
 * Handles serialization, deserialization, and error handling
 */
class StorageService {
    constructor() {
        this.STORAGE_KEY = 'todo_app_tasks';
        this.SETTINGS_KEY = 'todo_app_settings';
        this.isAvailable = this.checkStorageAvailability();
    }

    /**
     * Check if localStorage is available
     * @returns {boolean} True if localStorage is available
     */
    checkStorageAvailability() {
        try {
            const test = 'storage_test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            console.warn('localStorage is not available:', error);
            return false;
        }
    }

    /**
     * Save tasks to localStorage
     * @param {Array} tasks - Array of task objects
     * @returns {Promise<boolean>} Success status
     */
    async saveTasks(tasks) {
        try {
            if (!this.isAvailable) {
                throw new Error('localStorage is not available');
            }

            // Validate tasks array
            if (!Array.isArray(tasks)) {
                throw new Error('Tasks must be an array');
            }

            // Validate each task has required methods
            const validTasks = tasks.filter(task => {
                return task && typeof task.toJSON === 'function';
            });

            if (validTasks.length !== tasks.length) {
                console.warn(`Filtered out ${tasks.length - validTasks.length} invalid tasks`);
            }

            const serializedTasks = JSON.stringify(validTasks.map(task => task.toJSON()));
            
            // Check storage quota before saving
            const storageSize = new Blob([serializedTasks]).size;
            if (storageSize > 5 * 1024 * 1024) { // 5MB limit
                throw new Error('Data too large for localStorage (>5MB)');
            }

            localStorage.setItem(this.STORAGE_KEY, serializedTasks);
            
            console.log(`Saved ${validTasks.length} tasks to localStorage (${(storageSize / 1024).toFixed(2)}KB)`);
            return true;
        } catch (error) {
            console.error('Failed to save tasks:', error);
            
            // Try to save a backup with timestamp
            try {
                await this.saveBackup(tasks);
            } catch (backupError) {
                console.error('Failed to create backup:', backupError);
            }
            
            return false;
        }
    }

    /**
     * Load tasks from localStorage
     * @returns {Promise<Array>} Array of Task objects
     */
    async loadTasks() {
        try {
            if (!this.isAvailable) {
                console.warn('localStorage not available, returning empty array');
                return [];
            }

            const serializedTasks = localStorage.getItem(this.STORAGE_KEY);
            
            if (!serializedTasks) {
                console.log('No saved tasks found');
                return [];
            }

            let taskData;
            try {
                taskData = JSON.parse(serializedTasks);
            } catch (parseError) {
                console.error('Failed to parse saved tasks, data may be corrupted:', parseError);
                // Try to recover from backup
                return await this.loadFromBackup();
            }

            // Validate the parsed data
            if (!Array.isArray(taskData)) {
                console.error('Invalid task data format, expected array');
                return await this.loadFromBackup();
            }

            // Convert to Task objects with validation
            const tasks = [];
            let errors = 0;

            for (const data of taskData) {
                try {
                    // Validate required fields
                    if (!data.id || !data.text) {
                        console.warn('Skipping task with missing required fields:', data);
                        errors++;
                        continue;
                    }

                    const task = Task.fromJSON(data);
                    tasks.push(task);
                } catch (taskError) {
                    console.warn('Failed to create task from data:', data, taskError);
                    errors++;
                }
            }

            if (errors > 0) {
                console.warn(`Skipped ${errors} invalid tasks during load`);
                // Auto-save cleaned data
                await this.saveTasks(tasks);
            }
            
            console.log(`Loaded ${tasks.length} tasks from localStorage`);
            return tasks;
        } catch (error) {
            console.error('Failed to load tasks:', error);
            // Try to recover from backup
            return await this.loadFromBackup();
        }
    }

    /**
     * Clear all tasks from localStorage
     * @returns {Promise<boolean>} Success status
     */
    async clearTasks() {
        try {
            if (!this.isAvailable) {
                return false;
            }

            localStorage.removeItem(this.STORAGE_KEY);
            console.log('Cleared all tasks from localStorage');
            return true;
        } catch (error) {
            console.error('Failed to clear tasks:', error);
            return false;
        }
    }

    /**
     * Save application settings
     * @param {Object} settings - Settings object
     * @returns {Promise<boolean>} Success status
     */
    async saveSettings(settings) {
        try {
            if (!this.isAvailable) {
                return false;
            }

            const serializedSettings = JSON.stringify(settings);
            localStorage.setItem(this.SETTINGS_KEY, serializedSettings);
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    /**
     * Load application settings
     * @returns {Promise<Object>} Settings object
     */
    async loadSettings() {
        try {
            if (!this.isAvailable) {
                return this.getDefaultSettings();
            }

            const serializedSettings = localStorage.getItem(this.SETTINGS_KEY);
            
            if (!serializedSettings) {
                return this.getDefaultSettings();
            }

            return JSON.parse(serializedSettings);
        } catch (error) {
            console.error('Failed to load settings:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Get default application settings
     * @returns {Object} Default settings
     */
    getDefaultSettings() {
        return {
            theme: 'light',
            autoSave: true,
            defaultFilter: 'all',
            showCompletedTasks: true
        };
    }

    /**
     * Export tasks as JSON
     * @param {Array} tasks - Tasks to export
     * @returns {string} JSON string
     */
    exportTasks(tasks) {
        try {
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                tasks: tasks.map(task => task.toJSON())
            };
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Failed to export tasks:', error);
            return null;
        }
    }

    /**
     * Import tasks from JSON
     * @param {string} jsonData - JSON string containing tasks
     * @returns {Array|null} Array of Task objects or null if failed
     */
    importTasks(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            
            if (!importData.tasks || !Array.isArray(importData.tasks)) {
                throw new Error('Invalid import data format');
            }

            return importData.tasks.map(taskData => Task.fromJSON(taskData));
        } catch (error) {
            console.error('Failed to import tasks:', error);
            return null;
        }
    }

    /**
     * Get storage usage information
     * @returns {Object} Storage usage stats
     */
    getStorageInfo() {
        if (!this.isAvailable) {
            return { available: false };
        }

        try {
            const tasksData = localStorage.getItem(this.STORAGE_KEY) || '';
            const settingsData = localStorage.getItem(this.SETTINGS_KEY) || '';
            
            return {
                available: true,
                tasksSize: new Blob([tasksData]).size,
                settingsSize: new Blob([settingsData]).size,
                totalItems: localStorage.length
            };
        } catch (error) {
            return { available: false, error: error.message };
        }
    }

    /**
     * Backup tasks to a different key
     * @param {Array} tasks - Tasks to backup
     * @returns {Promise<boolean>} Success status
     */
    async backupTasks(tasks) {
        try {
            if (!this.isAvailable) {
                return false;
            }

            const backupKey = `${this.STORAGE_KEY}_backup_${Date.now()}`;
            const serializedTasks = JSON.stringify(tasks.map(task => task.toJSON()));
            localStorage.setItem(backupKey, serializedTasks);
            
            console.log(`Created backup with key: ${backupKey}`);
            return true;
        } catch (error) {
            console.error('Failed to backup tasks:', error);
            return false;
        }
    }

    /**
     * Save automatic backup
     * @param {Array} tasks - Tasks to backup
     * @returns {Promise<boolean>} Success status
     */
    async saveBackup(tasks) {
        try {
            if (!this.isAvailable) {
                return false;
            }

            const backupKey = `${this.STORAGE_KEY}_auto_backup`;
            const backupData = {
                timestamp: new Date().toISOString(),
                tasks: tasks.map(task => task.toJSON ? task.toJSON() : task)
            };
            
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            console.log('Auto backup saved');
            return true;
        } catch (error) {
            console.error('Failed to save auto backup:', error);
            return false;
        }
    }

    /**
     * Load tasks from backup
     * @returns {Promise<Array>} Array of Task objects from backup
     */
    async loadFromBackup() {
        try {
            if (!this.isAvailable) {
                return [];
            }

            const backupKey = `${this.STORAGE_KEY}_auto_backup`;
            const backupData = localStorage.getItem(backupKey);
            
            if (!backupData) {
                console.log('No backup data found');
                return [];
            }

            const backup = JSON.parse(backupData);
            if (!backup.tasks || !Array.isArray(backup.tasks)) {
                console.error('Invalid backup data format');
                return [];
            }

            const tasks = backup.tasks.map(data => Task.fromJSON(data));
            console.log(`Recovered ${tasks.length} tasks from backup (${backup.timestamp})`);
            return tasks;
        } catch (error) {
            console.error('Failed to load from backup:', error);
            return [];
        }
    }

    /**
     * Validate localStorage data integrity
     * @returns {Object} Validation result
     */
    validateStorageIntegrity() {
        try {
            if (!this.isAvailable) {
                return { isValid: false, error: 'localStorage not available' };
            }

            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) {
                return { isValid: true, message: 'No data to validate' };
            }

            const parsed = JSON.parse(data);
            if (!Array.isArray(parsed)) {
                return { isValid: false, error: 'Data is not an array' };
            }

            let validTasks = 0;
            let invalidTasks = 0;

            for (const taskData of parsed) {
                if (taskData.id && taskData.text) {
                    validTasks++;
                } else {
                    invalidTasks++;
                }
            }

            return {
                isValid: invalidTasks === 0,
                validTasks,
                invalidTasks,
                totalTasks: parsed.length
            };
        } catch (error) {
            return { isValid: false, error: error.message };
        }
    }
}