const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Business Search Function
exports.searchBusinesses = functions.https.onCall(async (data, context) => {
    try {
        // Verify user is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const { city, businessType, radius = 5000, userLocation } = data;

        if (!city || !businessType) {
            throw new functions.https.HttpsError('invalid-argument', 'City and business type are required.');
        }

        // Get user's remaining searches
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();

        if (!userData) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        // Check if user has remaining searches
        const remainingSearches = userData.remainingSearches || 0;
        if (remainingSearches <= 0) {
            throw new functions.https.HttpsError('permission-denied', 'No remaining searches. Please upgrade your account.');
        }

        // Here you would integrate with Google Places API
        // For now, we'll return mock data
        const mockBusinesses = [
            {
                id: '1',
                name: `Sample ${businessType} in ${city}`,
                address: `123 Main St, ${city}`,
                rating: 4.5,
                phone: '+1-555-0123',
                website: 'https://example.com',
                openNow: true,
                distance: Math.floor(Math.random() * radius)
            },
            {
                id: '2',
                name: `Another ${businessType} in ${city}`,
                address: `456 Oak Ave, ${city}`,
                rating: 4.2,
                phone: '+1-555-0456',
                website: 'https://example2.com',
                openNow: false,
                distance: Math.floor(Math.random() * radius)
            }
        ];

        // Update user's remaining searches
        await db.collection('users').doc(context.auth.uid).update({
            remainingSearches: remainingSearches - 1,
            lastSearchDate: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log the search
        await db.collection('searches').add({
            userId: context.auth.uid,
            city,
            businessType,
            radius,
            resultsCount: mockBusinesses.length,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ipAddress: context.rawRequest.ip || 'unknown'
        });

        return {
            businesses: mockBusinesses,
            remainingSearches: remainingSearches - 1,
            totalResults: mockBusinesses.length
        };

    } catch (error) {
        console.error('Error in searchBusinesses:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while searching for businesses.');
    }
});

// User Management Functions
exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
    try {
        await db.collection('users').doc(user.uid).set({
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            remainingSearches: 5, // Free trial searches
            isActive: true,
            role: 'user'
        });

        console.log('User profile created for:', user.email);
    } catch (error) {
        console.error('Error creating user profile:', error);
    }
});

exports.deleteUserProfile = functions.auth.user().onDelete(async (user) => {
    try {
        await db.collection('users').doc(user.uid).delete();
        console.log('User profile deleted for:', user.email);
    } catch (error) {
        console.error('Error deleting user profile:', error);
    }
});

// Admin Functions
exports.getUserStats = functions.https.onCall(async (data, context) => {
    try {
        // Verify admin role
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();

        if (!userData || userData.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
        }

        // Get user statistics
        const usersSnapshot = await db.collection('users').get();
        const searchesSnapshot = await db.collection('searches').get();

        const stats = {
            totalUsers: usersSnapshot.size,
            totalSearches: searchesSnapshot.size,
            activeUsers: 0,
            recentSearches: []
        };

        // Count active users (searched in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.lastSearchDate && userData.lastSearchDate.toDate() > thirtyDaysAgo) {
                stats.activeUsers++;
            }
        });

        // Get recent searches
        const recentSearchesSnapshot = await db.collection('searches')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        recentSearchesSnapshot.forEach(doc => {
            stats.recentSearches.push({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            });
        });

        return stats;

    } catch (error) {
        console.error('Error in getUserStats:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while fetching user statistics.');
    }
});

exports.updateUserSearches = functions.https.onCall(async (data, context) => {
    try {
        // Verify admin role
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        const userData = userDoc.data();

        if (!userData || userData.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
        }

        const { userId, remainingSearches } = data;

        if (!userId || remainingSearches === undefined) {
            throw new functions.https.HttpsError('invalid-argument', 'User ID and remaining searches are required.');
        }

        await db.collection('users').doc(userId).update({
            remainingSearches: parseInt(remainingSearches),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };

    } catch (error) {
        console.error('Error in updateUserSearches:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while updating user searches.');
    }
});

// Rate limiting function
exports.checkRateLimit = functions.https.onCall(async (data, context) => {
    try {
        const ip = context.rawRequest.ip || 'unknown';
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);

        // Check requests in the last minute
        const recentRequests = await db.collection('requests')
            .where('ip', '==', ip)
            .where('timestamp', '>', oneMinuteAgo)
            .get();

        if (recentRequests.size >= 10) { // Max 10 requests per minute
            throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded. Please try again later.');
        }

        // Log this request
        await db.collection('requests').add({
            ip,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: context.auth ? context.auth.uid : null
        });

        return { allowed: true };

    } catch (error) {
        console.error('Error in checkRateLimit:', error);
        throw error;
    }
});