// Google Maps integration
let map = null;
let markers = [];
let searchCircle = null;
let infoWindow = null;

// Initialize Google Maps
function initializeMap(businesses, searchCenter, radius) {
    const mapContainer = document.getElementById('map');

    if (!mapContainer || !businesses || !searchCenter) {
        console.error('Map initialization failed: missing required elements');
        return;
    }

    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps) {
        console.error('Google Maps API not loaded');
        showMapError();
        return;
    }

    try {
        // Create map centered on search location
        map = new google.maps.Map(mapContainer, {
            center: { lat: searchCenter.lat, lng: searchCenter.lng },
            zoom: getZoomLevel(radius),
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true,
            styles: getMapStyles()
        });

        // Create info window for markers
        infoWindow = new google.maps.InfoWindow();

        // Clear existing markers and circle
        clearMapElements();

        // Add search radius circle
        addSearchCircle(searchCenter, radius);

        // Add markers for businesses
        addBusinessMarkers(businesses);

        // Fit map to show all markers and circle
        fitMapToElements();

    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError();
    }
}

// Clear existing map elements
function clearMapElements() {
    // Clear markers
    markers.forEach(marker => {
        marker.setMap(null);
    });
    markers = [];

    // Clear search circle
    if (searchCircle) {
        searchCircle.setMap(null);
        searchCircle = null;
    }

    // Close info window
    if (infoWindow) {
        infoWindow.close();
    }
}

// Add search radius circle to map
function addSearchCircle(center, radiusKm) {
    searchCircle = new google.maps.Circle({
        strokeColor: '#007bff',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#007bff',
        fillOpacity: 0.15,
        map: map,
        center: center,
        radius: radiusKm * 1000 // Convert km to meters
    });
}

// Add business markers to map
function addBusinessMarkers(businesses) {
    businesses.forEach((business, index) => {
        if (!business.location || !business.location.lat || !business.location.lng) {
            return; // Skip businesses without valid location
        }

        const marker = new google.maps.Marker({
            position: {
                lat: business.location.lat,
                lng: business.location.lng
            },
            map: map,
            title: business.name,
            icon: getMarkerIcon(business.rating),
            animation: google.maps.Animation.DROP
        });

        // Add click listener to marker
        marker.addListener('click', () => {
            showBusinessInfoWindow(marker, business, index);
            highlightBusinessCard(index);
        });

        // Store marker reference
        markers[index] = marker;
    });
}

// Get custom marker icon based on rating
function getMarkerIcon(rating) {
    let color = '#007bff'; // Default blue

    if (rating >= 4.5) {
        color = '#28a745'; // Green for excellent ratings
    } else if (rating >= 4.0) {
        color = '#20c997'; // Teal for very good ratings
    } else if (rating >= 3.5) {
        color = '#ffc107'; // Yellow for good ratings
    } else if (rating >= 3.0) {
        color = '#fd7e14'; // Orange for fair ratings
    } else if (rating < 3.0) {
        color = '#dc3545'; // Red for poor ratings
    }

    return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 0.8,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 8
    };
}

// Show info window for business
function showBusinessInfoWindow(marker, business, index) {
    const starsHtml = generateStarsHtml(business.rating);
    const phoneHtml = business.phone ?
        `<p><i class="fas fa-phone"></i> <a href="tel:${business.phone}">${formatPhoneNumber(business.phone)}</a></p>` : '';
    const websiteHtml = business.website ?
        `<p><i class="fas fa-globe"></i> <a href="${business.website}" target="_blank" rel="noopener">Visit Website</a></p>` : '';
    const addressHtml = business.address ?
        `<p><i class="fas fa-map-marker-alt"></i> ${business.address}</p>` : '';

    const content = `
        <div style="max-width: 300px; font-family: 'Segoe UI', sans-serif;">
            <h4 style="margin: 0 0 10px 0; color: #343a40;">${escapeHtml(business.name)}</h4>
            
            ${business.rating ? `
            <div style="margin-bottom: 10px;">
                <div style="color: #ffc107; display: inline-block;">${starsHtml}</div>
                <span style="margin-left: 8px; color: #6c757d; font-size: 14px;">
                    ${business.rating} (${business.totalReviews || 0} reviews)
                </span>
            </div>
            ` : ''}
            
            <div style="font-size: 14px; color: #6c757d;">
                ${addressHtml}
                ${phoneHtml}
                ${websiteHtml}
                
                ${business.distance ? `
                <p><i class="fas fa-route"></i> ${business.distance} km away</p>
                ` : ''}
                
                ${business.operationalStatus ? `
                <p>
                    <span style="
                        padding: 4px 8px; 
                        border-radius: 12px; 
                        font-size: 12px; 
                        font-weight: 600;
                        background: ${getStatusColor(business.operationalStatus)};
                        color: white;
                    ">
                        ${business.operationalStatus}
                    </span>
                </p>
                ` : ''}
            </div>
            
            <div style="margin-top: 15px; text-align: center;">
                <button onclick="getDirections(${business.location.lat}, ${business.location.lng}, '${escapeHtml(business.name)}')" 
                        style="
                            background: #007bff; 
                            color: white; 
                            border: none; 
                            padding: 8px 16px; 
                            border-radius: 4px; 
                            cursor: pointer;
                            font-size: 14px;
                        ">
                    <i class="fas fa-directions"></i> Get Directions
                </button>
            </div>
        </div>
    `;

    infoWindow.setContent(content);
    infoWindow.open(map, marker);
}

// Get status color for styling
function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'operational':
        case 'open':
            return '#28a745';
        case 'closed_temporarily':
        case 'closed':
            return '#dc3545';
        default:
            return '#6c757d';
    }
}

// Focus on specific marker
function focusMarker(index) {
    if (markers[index]) {
        map.setCenter(markers[index].getPosition());
        map.setZoom(16);

        // Animate marker
        markers[index].setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => {
            markers[index].setAnimation(null);
        }, 2000);

        // Trigger click to show info window
        google.maps.event.trigger(markers[index], 'click');
    }
}

// Fit map to show all elements
function fitMapToElements() {
    if (!map || markers.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

    // Include all markers in bounds
    markers.forEach(marker => {
        bounds.extend(marker.getPosition());
    });

    // Include search circle bounds
    if (searchCircle) {
        bounds.union(searchCircle.getBounds());
    }

    // Fit map to bounds with padding
    map.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 50,
        left: 50
    });

    // Ensure minimum zoom level for readability
    const listener = google.maps.event.addListener(map, 'bounds_changed', () => {
        if (map.getZoom() > 15) {
            map.setZoom(15);
        }
        google.maps.event.removeListener(listener);
    });
}

// Get appropriate zoom level based on radius
function getZoomLevel(radiusKm) {
    if (radiusKm <= 5) return 13;
    if (radiusKm <= 10) return 12;
    if (radiusKm <= 20) return 11;
    if (radiusKm <= 50) return 10;
    return 9;
}

// Get custom map styles
function getMapStyles() {
    return [
        {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
        },
        {
            featureType: 'transit',
            elementType: 'labels.icon',
            stylers: [{ visibility: 'off' }]
        }
    ];
}

// Open Google Maps for directions
function getDirections(lat, lng, name) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`;
    window.open(url, '_blank');
}

// Show map error message
function showMapError() {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div style="
                display: flex; 
                align-items: center; 
                justify-content: center; 
                height: 100%; 
                background: #f8f9fa; 
                color: #6c757d;
                flex-direction: column;
                gap: 1rem;
            ">
                <i class="fas fa-map-marked-alt" style="font-size: 3rem;"></i>
                <p style="margin: 0; text-align: center;">
                    Map could not be loaded.<br>
                    Please check your internet connection.
                </p>
            </div>
        `;
    }
}

// Highlight business card (imported from search.js)
function highlightBusinessCard(index) {
    if (window.searchModule && window.searchModule.highlightBusinessCard) {
        window.searchModule.highlightBusinessCard(index);
    }
}

// Generate stars HTML (imported from search.js)
function generateStarsHtml(rating) {
    if (!rating) return '';

    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHtml = '';

    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star"></i>';
    }

    if (hasHalfStar) {
        starsHtml += '<i class="fas fa-star-half-alt"></i>';
    }

    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star"></i>';
    }

    return starsHtml;
}

// Escape HTML (imported from search.js)
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, function (m) { return map[m]; }) : '';
}

// Handle window resize
function handleMapResize() {
    if (map) {
        google.maps.event.trigger(map, 'resize');
        fitMapToElements();
    }
}

// Add resize listener
window.addEventListener('resize', handleMapResize);

// Make getDirections globally available
window.getDirections = getDirections;

// Export functions for use in other modules
window.mapModule = {
    initializeMap,
    focusMarker,
    clearMapElements,
    handleMapResize
};