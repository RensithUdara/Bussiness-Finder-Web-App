// Search functionality
const { db, functions } = window.firebaseApp;

let currentSearchResults = [];
let searchInProgress = false;

// Initialize search functionality
function initializeSearch() {
    const searchForm = document.getElementById('searchForm');
    
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
}

// Handle search form submission
async function handleSearch(e) {
    e.preventDefault();
    
    if (searchInProgress) return;
    
    const city = document.getElementById('city').value.trim();
    const businessType = document.getElementById('businessType').value;
    const radius = parseInt(document.getElementById('radius').value);
    
    // Validate inputs
    if (!city || !businessType || !radius) {
        showNotification('Please fill in all search fields', 'warning');
        return;
    }
    
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
        showNotification('Please sign in to search for businesses', 'warning');
        return;
    }
    
    // Check user's trial count
    const userData = await getUserData(user.uid);
    if (!userData) {
        showNotification('Error loading user data', 'error');
        return;
    }
    
    if (userData.trialCount <= 0 && !userData.isPremium) {
        showTrialExhaustedMessage();
        return;
    }
    
    // Start search
    searchInProgress = true;
    showLoadingOverlay(true);
    
    try {
        // Call Cloud Function to search businesses
        const searchBusinesses = functions.httpsCallable('searchBusinesses');
        const result = await searchBusinesses({
            city: city,
            businessType: businessType,
            radiusKm: radius
        });
        
        const { businesses, searchCenter, message } = result.data;
        
        if (businesses && businesses.length > 0) {
            currentSearchResults = businesses;
            displaySearchResults(businesses, city, businessType, radius);
            initializeMap(businesses, searchCenter, radius);
            
            // Update trial counter in real-time
            updateTrialCounter(userData.trialCount - 1);
            
            showNotification(`Found ${businesses.length} businesses in ${city}`, 'success');
        } else {
            showNoResults();
            showNotification(message || 'No businesses found. Try different search criteria.', 'info');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        
        let errorMessage = 'Search failed. Please try again.';
        
        if (error.code === 'unauthenticated') {
            errorMessage = 'Please sign in to search for businesses.';
        } else if (error.code === 'permission-denied') {
            errorMessage = 'You don\'t have permission to perform this search.';
        } else if (error.code === 'resource-exhausted') {
            errorMessage = 'You have used all your free searches. Please upgrade to continue.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
        showNoResults();
    } finally {
        searchInProgress = false;
        showLoadingOverlay(false);
    }
}

// Display search results
function displaySearchResults(businesses, city, businessType, radius) {
    const resultsSection = document.getElementById('resultsSection');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsCount = document.getElementById('resultsCount');
    const resultsList = document.getElementById('resultsList');
    const noResults = document.getElementById('noResults');
    
    // Hide no results message
    if (noResults) {
        noResults.style.display = 'none';
    }
    
    // Update results header
    if (resultsTitle) {
        resultsTitle.textContent = `${getBusinessTypeLabel(businessType)} in ${city}`;
    }
    
    if (resultsCount) {
        resultsCount.textContent = `${businesses.length} results within ${radius} km`;
    }
    
    // Clear previous results
    if (resultsList) {
        resultsList.innerHTML = '';
        
        // Create business cards
        businesses.forEach((business, index) => {
            const businessCard = createBusinessCard(business, index);
            resultsList.appendChild(businessCard);
        });
    }
    
    // Show results section
    if (resultsSection) {
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Create a business card element
function createBusinessCard(business, index) {
    const card = document.createElement('div');
    card.className = 'business-card';
    card.setAttribute('data-index', index);
    
    // Generate star rating HTML
    const starsHtml = generateStarsHtml(business.rating);
    
    // Format phone number
    const phoneHtml = business.phone ? 
        `<div class="info-item">
            <i class="fas fa-phone"></i>
            <a href="tel:${business.phone}">${formatPhoneNumber(business.phone)}</a>
        </div>` : '';
    
    // Format website
    const websiteHtml = business.website ? 
        `<div class="info-item">
            <i class="fas fa-globe"></i>
            <a href="${business.website}" target="_blank" rel="noopener">Visit Website</a>
        </div>` : '';
    
    // Format address
    const addressHtml = business.address ? 
        `<div class="info-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>${business.address}</span>
        </div>` : '';
    
    // Format distance
    const distanceHtml = business.distance ? 
        `<div class="info-item">
            <i class="fas fa-route"></i>
            <span>${business.distance} km away</span>
        </div>` : '';
    
    // Format operational status
    const statusHtml = business.operationalStatus ? 
        `<div class="business-status">
            <span class="status-badge status-${getStatusClass(business.operationalStatus)}">
                ${business.operationalStatus}
            </span>
        </div>` : '';
    
    card.innerHTML = `
        <div class="business-header">
            <div>
                <h3 class="business-name">${escapeHtml(business.name)}</h3>
                ${business.rating ? `
                <div class="business-rating">
                    <div class="stars">${starsHtml}</div>
                    <span class="rating-text">${business.rating} (${business.totalReviews || 0} reviews)</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="business-info">
            ${addressHtml}
            ${phoneHtml}
            ${websiteHtml}
            ${distanceHtml}
        </div>
        
        ${statusHtml}
    `;
    
    // Add click handler to highlight corresponding map marker
    card.addEventListener('click', () => {
        highlightBusinessCard(index);
        if (window.mapModule && window.mapModule.focusMarker) {
            window.mapModule.focusMarker(index);
        }
    });
    
    return card;
}

// Generate star rating HTML
function generateStarsHtml(rating) {
    if (!rating) return '';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHtml = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star"></i>';
    }
    
    // Half star
    if (hasHalfStar) {
        starsHtml += '<i class="fas fa-star-half-alt"></i>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star"></i>';
    }
    
    return starsHtml;
}

// Get business type label
function getBusinessTypeLabel(type) {
    const labels = {
        'restaurant': 'Restaurants',
        'gas_station': 'Gas Stations',
        'hospital': 'Hospitals',
        'pharmacy': 'Pharmacies',
        'bank': 'Banks',
        'atm': 'ATMs',
        'supermarket': 'Supermarkets',
        'shopping_mall': 'Shopping Malls',
        'hotel': 'Hotels',
        'school': 'Schools',
        'gym': 'Gyms',
        'beauty_salon': 'Beauty Salons',
        'car_repair': 'Car Repair Shops',
        'dentist': 'Dentists',
        'lawyer': 'Lawyers',
        'real_estate_agency': 'Real Estate Agencies',
        'tourist_attraction': 'Tourist Attractions'
    };
    
    return labels[type] || 'Businesses';
}

// Get status class for styling
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'operational':
        case 'open':
            return 'open';
        case 'closed_temporarily':
        case 'closed':
            return 'closed';
        default:
            return 'unknown';
    }
}

// Highlight business card
function highlightBusinessCard(index) {
    // Remove previous highlights
    const cards = document.querySelectorAll('.business-card');
    cards.forEach(card => card.classList.remove('highlighted'));
    
    // Highlight selected card
    const selectedCard = document.querySelector(`[data-index="${index}"]`);
    if (selectedCard) {
        selectedCard.classList.add('highlighted');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Show no results message
function showNoResults() {
    const resultsSection = document.getElementById('resultsSection');
    const noResults = document.getElementById('noResults');
    
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
    
    if (noResults) {
        noResults.style.display = 'block';
    }
}

// Show/hide loading overlay
function showLoadingOverlay(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

// Show trial exhausted message
function showTrialExhaustedMessage() {
    const message = `
        <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ffc107; margin-bottom: 1rem;"></i>
            <h3 style="color: #343a40; margin-bottom: 1rem;">Free Trials Exhausted</h3>
            <p style="color: #6c757d; margin-bottom: 2rem;">You've used all your free searches. Upgrade to continue finding businesses.</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button class="btn btn-primary" onclick="alert('Upgrade functionality coming soon!')">
                    <i class="fas fa-crown"></i>
                    Upgrade Now
                </button>
                <button class="btn btn-secondary" onclick="alert('Contact support functionality coming soon!')">
                    <i class="fas fa-envelope"></i>
                    Contact Support
                </button>
            </div>
        </div>
    `;
    
    const resultsSection = document.getElementById('resultsSection');
    const noResults = document.getElementById('noResults');
    
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
    
    if (noResults) {
        noResults.innerHTML = message;
        noResults.style.display = 'block';
    }
}

// Update trial counter in real-time
function updateTrialCounter(newCount) {
    const trialCountElement = document.getElementById('trialCount');
    const trialCounter = document.getElementById('trialCounter');
    
    if (trialCountElement) {
        trialCountElement.textContent = `Trials remaining: ${newCount}`;
    }
    
    // Update styling based on remaining trials
    if (trialCounter) {
        if (newCount === 0) {
            trialCounter.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
        } else if (newCount === 1) {
            trialCounter.style.background = 'linear-gradient(135deg, #ffc107, #e0a800)';
        }
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Initialize search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeSearch();
});

// Export functions for use in other modules
window.searchModule = {
    initializeSearch,
    handleSearch,
    displaySearchResults,
    highlightBusinessCard,
    currentSearchResults: () => currentSearchResults
};