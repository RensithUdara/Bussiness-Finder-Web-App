const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = functions.config().google?.places_api_key || 'YOUR_GOOGLE_PLACES_API_KEY';
const GOOGLE_GEOCODING_API_KEY = functions.config().google?.geocoding_api_key || 'YOUR_GOOGLE_GEOCODING_API_KEY';

/**
 * Search for businesses using Google Places API
 */
exports.searchBusinesses = functions.https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { city, businessType, radiusKm } = data;
    const userId = context.auth.uid;

    // Validate inputs
    if (!city || !businessType || !radiusKm) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    if (radiusKm < 1 || radiusKm > 100) {
        throw new functions.https.HttpsError('invalid-argument', 'Radius must be between 1 and 100 km');
    }

    try {
        // Check user's trial count and ban status
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found');
        }

        const userData = userDoc.data();
        if (userData.isBanned) {
            throw new functions.https.HttpsError('permission-denied', 'User is banned');
        }

        if (userData.trialCount <= 0 && !userData.isPremium) {
            throw new functions.https.HttpsError('resource-exhausted', 'No trials remaining');
        }

        // Check for cached results (optional optimization)
        const cacheKey = `${city.toLowerCase()}-${businessType}-${radiusKm}`;
        const cacheDoc = await db.collection('searchCache').doc(cacheKey).get();
        
        if (cacheDoc.exists) {
            const cacheData = cacheDoc.data();
            const cacheAge = Date.now() - cacheData.timestamp.toMillis();
            
            // Use cache if less than 15 minutes old
            if (cacheAge < 15 * 60 * 1000) {
                console.log('Returning cached results for:', cacheKey);
                return {
                    businesses: cacheData.businesses,
                    searchCenter: cacheData.searchCenter,
                    message: 'Results from cache'
                };
            }
        }

        // Step 1: Geocode the city
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${GOOGLE_GEOCODING_API_KEY}`;
        const geocodeResponse = await axios.get(geocodeUrl);

        if (geocodeResponse.data.status !== 'OK' || !geocodeResponse.data.results.length) {
            throw new functions.https.HttpsError('not-found', `City "${city}" not found`);
        }

        const location = geocodeResponse.data.results[0].geometry.location;
        const searchCenter = {
            lat: location.lat,
            lng: location.lng
        };

        // Step 2: Search for businesses using Places API
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
        const placesParams = {
            location: `${searchCenter.lat},${searchCenter.lng}`,
            radius: radiusKm * 1000, // Convert km to meters
            type: businessType,
            key: GOOGLE_PLACES_API_KEY
        };

        const placesResponse = await axios.get(placesUrl, { params: placesParams });

        if (placesResponse.data.status !== 'OK') {
            console.error('Places API error:', placesResponse.data.status);
            throw new functions.https.HttpsError('internal', 'Failed to search businesses');
        }

        // Step 3: Process and format results
        const businesses = placesResponse.data.results.map(place => {
            const business = {
                name: place.name,
                address: place.vicinity || place.formatted_address,
                rating: place.rating,
                totalReviews: place.user_ratings_total,
                location: {
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng
                },
                placeId: place.place_id,
                operationalStatus: place.business_status
            };

            // Calculate distance from search center
            business.distance = calculateDistance(
                searchCenter.lat,
                searchCenter.lng,
                business.location.lat,
                business.location.lng
            );

            return business;
        });

        // Sort by distance
        businesses.sort((a, b) => a.distance - b.distance);

        // Step 4: Get additional details for businesses (optional - costs more)
        // Uncomment if you need phone numbers and websites
        /*
        const detailedBusinesses = await Promise.all(
            businesses.slice(0, 10).map(async (business) => { // Limit to first 10 to control costs
                try {
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json`;
                    const detailsParams = {
                        place_id: business.placeId,
                        fields: 'formatted_phone_number,website,opening_hours',
                        key: GOOGLE_PLACES_API_KEY
                    };

                    const detailsResponse = await axios.get(detailsUrl, { params: detailsParams });
                    
                    if (detailsResponse.data.status === 'OK') {
                        const details = detailsResponse.data.result;
                        business.phone = details.formatted_phone_number;
                        business.website = details.website;
                        business.openingHours = details.opening_hours;
                    }
                } catch (error) {
                    console.error('Error getting place details:', error);
                }
                
                return business;
            })
        );
        */

        // Step 5: Save search record
        const searchId = db.collection('searches').doc().id;
        const searchData = {
            userId: userId,
            city: city,
            businessType: businessType,
            radiusKm: radiusKm,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            resultsCount: businesses.length,
            searchCenter: new admin.firestore.GeoPoint(searchCenter.lat, searchCenter.lng),
            ipAddress: context.rawRequest.ip || 'unknown'
        };

        await db.collection('searches').doc(searchId).set(searchData);

        // Step 6: Save results as subcollection
        const batch = db.batch();
        businesses.forEach((business, index) => {
            const resultRef = db.collection('searches').doc(searchId).collection('results').doc(`result_${index}`);
            batch.set(resultRef, business);
        });
        await batch.commit();

        // Step 7: Update user's trial count
        await db.collection('users').doc(userId).update({
            trialCount: admin.firestore.FieldValue.increment(-1),
            lastSearchDate: admin.firestore.FieldValue.serverTimestamp()
        });

        // Step 8: Cache results (optional)
        await db.collection('searchCache').doc(cacheKey).set({
            businesses: businesses,
            searchCenter: searchCenter,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Search completed: ${businesses.length} businesses found in ${city}`);

        return {
            businesses: businesses,
            searchCenter: searchCenter,
            message: `Found ${businesses.length} businesses`
        };

    } catch (error) {
        console.error('Search error:', error);
        
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        throw new functions.https.HttpsError('internal', 'Search failed');
    }
});

/**
 * Track IP address when user signs up
 */
exports.trackUserIP = functions.auth.user().onCreate(async (user) => {
    try {
        // Note: Getting real IP from auth trigger is limited
        // In production, you might need to use a different approach
        const ipAddress = 'auth-trigger-ip'; // Placeholder
        
        // Check if IP record exists
        const ipRef = db.collection('ipUsage').doc(ipAddress);
        const ipDoc = await ipRef.get();
        
        if (ipDoc.exists) {
            // Update existing IP record
            await ipRef.update({
                accountCount: admin.firestore.FieldValue.increment(1),
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                associatedUsers: admin.firestore.FieldValue.arrayUnion(user.uid)
            });
        } else {
            // Create new IP record
            await ipRef.set({
                accountCount: 1,
                firstSeen: admin.firestore.FieldValue.serverTimestamp(),
                lastSeen: admin.firestore.FieldValue.serverTimestamp(),
                associatedUsers: [user.uid],
                isBlocked: false
            });
        }

        console.log(`IP tracking updated for user: ${user.uid}`);
        
    } catch (error) {
        console.error('Error tracking IP:', error);
    }
});

/**
 * Admin function to ban a user
 */
exports.banUser = functions.https.onCall(async (data, context) => {
    // Check authentication and admin status
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!adminDoc.exists || !adminDoc.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');
    }

    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    try {
        await db.collection('users').doc(userId).update({
            isBanned: true,
            bannedAt: admin.firestore.FieldValue.serverTimestamp(),
            bannedBy: context.auth.uid
        });

        console.log(`User ${userId} banned by admin ${context.auth.uid}`);
        return { success: true };

    } catch (error) {
        console.error('Error banning user:', error);
        throw new functions.https.HttpsError('internal', 'Failed to ban user');
    }
});

/**
 * Admin function to unban a user
 */
exports.unbanUser = functions.https.onCall(async (data, context) => {
    // Check authentication and admin status
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!adminDoc.exists || !adminDoc.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');
    }

    const { userId } = data;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'User ID is required');
    }

    try {
        await db.collection('users').doc(userId).update({
            isBanned: false,
            unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
            unbannedBy: context.auth.uid
        });

        console.log(`User ${userId} unbanned by admin ${context.auth.uid}`);
        return { success: true };

    } catch (error) {
        console.error('Error unbanning user:', error);
        throw new functions.https.HttpsError('internal', 'Failed to unban user');
    }
});

/**
 * Admin function to block an IP address
 */
exports.blockIP = functions.https.onCall(async (data, context) => {
    // Check authentication and admin status
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!adminDoc.exists || !adminDoc.data().isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin privileges required');
    }

    const { ipAddress } = data;
    if (!ipAddress) {
        throw new functions.https.HttpsError('invalid-argument', 'IP address is required');
    }

    try {
        await db.collection('ipUsage').doc(ipAddress).update({
            isBlocked: true,
            blockedAt: admin.firestore.FieldValue.serverTimestamp(),
            blockedBy: context.auth.uid
        });

        console.log(`IP ${ipAddress} blocked by admin ${context.auth.uid}`);
        return { success: true };

    } catch (error) {
        console.error('Error blocking IP:', error);
        throw new functions.https.HttpsError('internal', 'Failed to block IP');
    }
});

/**
 * Helper function to calculate distance between two points
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Scheduled function to clean up old cache entries
 */
exports.cleanupCache = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const cutoffTime = admin.firestore.Timestamp.fromMillis(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
    
    const oldCacheQuery = db.collection('searchCache')
        .where('timestamp', '<', cutoffTime);
    
    const snapshot = await oldCacheQuery.get();
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`Cleaned up ${snapshot.size} old cache entries`);
    return null;
});

/**
 * HTTP function to get server status (for monitoring)
 */
exports.status = functions.https.onRequest((req, res) => {
    cors(req, res, () => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    });
});