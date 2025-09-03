import { ARRAY_LIMITS, estimateArrayMemory, PERFORMANCE_THRESHOLDS } from '../constants.js';

/**
 * ArrayManager - Utilities for managing array limits and memory usage
 */
export class ArrayManager {
    /**
     * Enforce array limit by keeping only the most recent items
     * @param {Array} array - Current array
     * @param {*} newItem - New item to add
     * @param {number} limit - Maximum array size
     * @returns {Array} - New array with enforced limit
     */
    static enforceLimit(array, newItem, limit) {
        const newArray = [...array, newItem];
        
        if (newArray.length > limit) {
            // Keep only the most recent items
            return newArray.slice(-limit);
        }
        
        return newArray;
    }

    /**
     * Enforce limit for multiple new items
     * @param {Array} array - Current array  
     * @param {Array} newItems - New items to add
     * @param {number} limit - Maximum array size
     * @returns {Array} - New array with enforced limit
     */
    static enforceLimitMultiple(array, newItems, limit) {
        const newArray = [...array, ...newItems];
        
        if (newArray.length > limit) {
            return newArray.slice(-limit);
        }
        
        return newArray;
    }

    /**
     * Get appropriate limit for array type
     * @param {string} arrayName - Name/type of the array
     * @returns {number} - Appropriate limit
     */
    static getLimit(arrayName) {
        const lowerName = arrayName.toLowerCase();
        
        if (lowerName.includes('prerace') || lowerName.includes('pre_race')) {
            return ARRAY_LIMITS.PRE_RACE_POSITIONS;
        }
        if (lowerName.includes('racetrack') || lowerName.includes('race_track')) {
            return ARRAY_LIMITS.RACE_TRACK_POSITIONS;
        }
        if (lowerName.includes('finish') || lowerName.includes('buffer')) {
            return ARRAY_LIMITS.FINISH_BUFFER;
        }
        if (lowerName.includes('speed')) {
            return ARRAY_LIMITS.SPEED_MEASUREMENTS;
        }
        if (lowerName.includes('elevation')) {
            return ARRAY_LIMITS.ELEVATION_SAMPLES;
        }
        if (lowerName.includes('track')) {
            return ARRAY_LIMITS.NEARBY_TRACKS;
        }
        
        // Default fallback
        return 100;
    }

    /**
     * Check if arrays are approaching memory limits
     * @param {Object} stateArrays - Object with array properties from state
     * @returns {Object} - Analysis result
     */
    static analyzeMemoryUsage(stateArrays) {
        const memoryUsage = estimateArrayMemory(stateArrays);
        const warnings = [];
        const criticalArrays = [];
        
        // Check overall memory usage
        if (memoryUsage.megabytes > PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB) {
            warnings.push(`Total memory usage: ${memoryUsage.megabytes}MB (exceeds ${PERFORMANCE_THRESHOLDS.MAX_MEMORY_MB}MB threshold)`);
        }
        
        // Check individual arrays
        for (const [arrayName, array] of Object.entries(stateArrays)) {
            if (!Array.isArray(array)) continue;
            
            const limit = this.getLimit(arrayName);
            const usageRatio = array.length / limit;
            
            // Check if approaching limit
            if (usageRatio >= PERFORMANCE_THRESHOLDS.CLEANUP_TRIGGER_RATIO) {
                warnings.push(`${arrayName}: ${array.length}/${limit} items (${Math.round(usageRatio * 100)}% full)`);
            }
            
            // Check if exceeding safe limits
            if (array.length > PERFORMANCE_THRESHOLDS.MAX_ARRAY_LENGTH) {
                criticalArrays.push({
                    name: arrayName,
                    length: array.length,
                    limit: limit,
                    exceedsBy: array.length - limit
                });
            }
        }
        
        return {
            memoryUsage,
            warnings,
            criticalArrays,
            needsCleanup: warnings.length > 0 || criticalArrays.length > 0
        };
    }

    /**
     * Clean up arrays that exceed their limits
     * @param {Object} stateArrays - State arrays to clean
     * @returns {Object} - Cleaned arrays
     */
    static cleanupArrays(stateArrays) {
        const cleanedArrays = {};
        let totalCleaned = 0;
        
        for (const [arrayName, array] of Object.entries(stateArrays)) {
            if (!Array.isArray(array)) {
                cleanedArrays[arrayName] = array;
                continue;
            }
            
            const limit = this.getLimit(arrayName);
            
            if (array.length > limit) {
                // Keep only the most recent items
                cleanedArrays[arrayName] = array.slice(-limit);
                totalCleaned += array.length - limit;
            } else {
                cleanedArrays[arrayName] = array;
            }
        }
        
        return {
            cleanedArrays,
            totalItemsRemoved: totalCleaned
        };
    }

    /**
     * Log memory usage for debugging
     * @param {Object} stateArrays - State arrays to analyze
     * @param {string} context - Context for the log
     */
    static logMemoryUsage(stateArrays, context = '') {
        const analysis = this.analyzeMemoryUsage(stateArrays);
        const prefix = context ? `[${context}] ` : '';
        
        console.log(`${prefix}Memory Usage: ${analysis.memoryUsage.megabytes}MB (${analysis.memoryUsage.kilobytes}KB)`);
        
        if (analysis.warnings.length > 0) {
            console.warn(`${prefix}Memory Warnings:`, analysis.warnings);
        }
        
        if (analysis.criticalArrays.length > 0) {
            console.error(`${prefix}Critical Arrays:`, analysis.criticalArrays);
        }
        
        // Log array sizes for debugging
        const arraySizes = Object.entries(stateArrays)
            .filter(([_, value]) => Array.isArray(value))
            .map(([name, array]) => `${name}: ${array.length}`)
            .join(', ');
            
        console.log(`${prefix}Array Sizes: ${arraySizes}`);
    }
}