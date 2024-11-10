import mongoose from "mongoose";
import Event from '../models/eventModel.js';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
let eventsCache = {
    data: null,
    lastUpdated: null
};

const getAllEventDetails = async (req, res) => {
    try {
        // Check cache first
        if (eventsCache.data && 
            eventsCache.lastUpdated && 
            (Date.now() - eventsCache.lastUpdated) < CACHE_TTL) {
            return res.status(200).json(eventsCache.data);
        }

        // If not in cache or cache expired, fetch from DB
        const events = await Event.find()
            .select('-__v')  // Exclude version field
            .lean()          // Convert to plain objects
            .cache(CACHE_TTL); // Enable mongoose cache if you have cache plugin

        if (!events) {
            return res.status(404).json({
                success: false,
                message: 'No events found'
            });
        }

        // Update cache
        eventsCache = {
            data: events,
            lastUpdated: Date.now()
        };

        // Set appropriate cache headers
        res.set({
            'Cache-Control': `public, max-age=${CACHE_TTL / 1000}`,
            'ETag': mongoose.Types.ObjectId().toString()
        });

        return res.status(200).json({
            success: true,
            count: events.length,
            data: events
        });

    } catch (error) {
        console.error("Error retrieving event details:", error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving events',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Preload cache on server start
const preloadCache = async () => {
    try {
        const events = await Event.find()
            .select('-__v')
            .lean();

        eventsCache = {
            data: events,
            lastUpdated: Date.now()
        };
        
        console.log('Events cache preloaded successfully');
    } catch (error) {
        console.error('Failed to preload events cache:', error);
    }
};

// Export both the main function and preload function
export { getAllEventDetails as default, preloadCache };