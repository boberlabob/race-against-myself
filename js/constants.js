// ARRAY LIMITS - Memory Management Constants
// These limits prevent memory leaks from unbounded array growth

export const ARRAY_LIMITS = {
    // GPS position arrays
    PRE_RACE_POSITIONS: 50,     // Max GPS points before race start (~20KB memory)
    RACE_TRACK_POSITIONS: 5000, // Max GPS points during race (~5MB memory max)
    FINISH_BUFFER: 20,          // Max GPS points for finish detection (~10KB memory)
    
    // Performance arrays  
    SPEED_MEASUREMENTS: 10,     // Already implemented - rolling average window
    
    // Future extensions
    ELEVATION_SAMPLES: 100,     // For elevation profile smoothing
    NEARBY_TRACKS: 50           // Max nearby tracks to display
};

// Memory estimation constants
export const MEMORY_ESTIMATES = {
    GPS_POINT_SIZE: 100,        // ~100 bytes per GPS point (lat, lon, timestamp, accuracy, etc.)
    TRACK_METADATA_SIZE: 1024,  // ~1KB per track metadata
    STATE_OVERHEAD: 50          // ~50 bytes per array entry overhead
};

// Calculate estimated memory usage for arrays
export function estimateArrayMemory(arrays) {
    let totalMemory = 0;
    
    for (const [arrayName, array] of Object.entries(arrays)) {
        if (!Array.isArray(array)) continue;
        
        let itemSize = MEMORY_ESTIMATES.GPS_POINT_SIZE; // Default
        
        // Adjust size based on array type
        if (arrayName.includes('track') || arrayName.includes('Track')) {
            itemSize = MEMORY_ESTIMATES.TRACK_METADATA_SIZE;
        }
        
        totalMemory += array.length * (itemSize + MEMORY_ESTIMATES.STATE_OVERHEAD);
    }
    
    return {
        bytes: totalMemory,
        kilobytes: Math.round(totalMemory / 1024),
        megabytes: Math.round(totalMemory / (1024 * 1024) * 10) / 10 // 1 decimal place
    };
}

// Memory cleanup interval
export const MEMORY_CLEANUP_INTERVAL = 60000; // 1 minute

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
    MAX_MEMORY_MB: 10,          // Alert if memory usage exceeds 10MB
    MAX_ARRAY_LENGTH: 10000,    // Alert if any single array exceeds this
    CLEANUP_TRIGGER_RATIO: 0.8  // Cleanup when 80% of limit is reached
};