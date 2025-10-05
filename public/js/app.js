// Main application logic
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

// Initialize the application
function initializeApp() {
    // Set up global error handling
    setupErrorHandling();

    // Initialize based on current page
    const currentPage = window.location.pathname;

    if (currentPage.includes('admin.html')) {
        // Admin page initialization is handled in admin.js
        return;
    } else if (currentPage.includes('login.html')) {
        // Login page initialization is handled in auth.js
        return;
    } else if (currentPage.includes('signup.html')) {
        // Signup page initialization is handled in auth.js
        return;
    } else {
        // Main page (index.html)
        initializeMainPage();
    }
}

// Initialize main page
function initializeMainPage() {
    // Initialize authentication
    if (window.authModule) {
        window.authModule.initializeAuth();
    }

    // Initialize search functionality
    if (window.searchModule) {
        window.searchModule.initializeSearch();
    }

    // Check for Google Maps API
    checkGoogleMapsAPI();

    // Set up responsive menu (if needed)
    setupResponsiveMenu();

    // Set up smooth scrolling
    setupSmoothScrolling();

    // Initialize tooltips (if any)
    initializeTooltips();

    // Check for updates (optional feature)
    checkForUpdates();
}

// Setup global error handling
function setupErrorHandling() {
    // Handle uncaught errors
    window.addEventListener('error', function (event) {
        console.error('Global error:', event.error);

        // Don't show notification for minor errors
        if (event.error && event.error.name !== 'ResizeObserver loop limit exceeded') {
            showNotification('Something went wrong. Please refresh the page.', 'error');
        }
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function (event) {
        console.error('Unhandled promise rejection:', event.reason);

        // Prevent the default browser behavior
        event.preventDefault();

        // Show user-friendly error message
        showNotification('Network error. Please check your connection.', 'error');
    });

    // Handle Firebase Auth errors globally
    if (window.firebaseApp && window.firebaseApp.auth) {
        window.firebaseApp.auth.onAuthStateChanged(null, (error) => {
            console.error('Auth state error:', error);
            showNotification('Authentication error. Please sign in again.', 'error');
        });
    }
}

// Check Google Maps API availability
function checkGoogleMapsAPI() {
    let attempts = 0;
    const maxAttempts = 10;

    const checkAPI = () => {
        if (typeof google !== 'undefined' && google.maps) {
            console.log('Google Maps API loaded successfully');
            return;
        }

        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(checkAPI, 500);
        } else {
            console.warn('Google Maps API failed to load');
            showMapAPIError();
        }
    };

    // Start checking after a short delay
    setTimeout(checkAPI, 1000);
}

// Show Google Maps API error
function showMapAPIError() {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="map-error">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Maps Unavailable</h4>
                <p>Google Maps could not be loaded. Please check your internet connection or try again later.</p>
                <button onclick="location.reload()" class="btn btn-primary">
                    <i class="fas fa-refresh"></i>
                    Retry
                </button>
            </div>
        `;

        // Add error styles
        const style = document.createElement('style');
        style.textContent = `
            .map-error {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                background: #f8f9fa;
                color: #6c757d;
                text-align: center;
                padding: 2rem;
            }
            .map-error i {
                font-size: 3rem;
                margin-bottom: 1rem;
                color: #ffc107;
            }
            .map-error h4 {
                margin-bottom: 0.5rem;
                color: #343a40;
            }
            .map-error p {
                margin-bottom: 1.5rem;
                max-width: 300px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Setup responsive menu
function setupResponsiveMenu() {
    // Add mobile menu toggle if needed
    const navbar = document.querySelector('.navbar');
    if (navbar && window.innerWidth <= 768) {
        // Add mobile menu functionality if needed
        console.log('Mobile layout detected');
    }
}

// Setup smooth scrolling
function setupSmoothScrolling() {
    // Add smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Initialize tooltips
function initializeTooltips() {
    // Add tooltips to elements with title attributes
    document.querySelectorAll('[title]').forEach(element => {
        const title = element.getAttribute('title');
        if (title) {
            element.addEventListener('mouseenter', showTooltip);
            element.addEventListener('mouseleave', hideTooltip);
        }
    });
}

// Show tooltip
function showTooltip(event) {
    const title = event.target.getAttribute('title');
    if (!title) return;

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    tooltip.textContent = title;
    tooltip.style.cssText = `
        position: absolute;
        background: #343a40;
        color: white;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.8rem;
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
    `;

    document.body.appendChild(tooltip);

    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';

    // Show tooltip
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 100);

    // Store reference for cleanup
    event.target._tooltip = tooltip;

    // Temporarily remove title to prevent browser default
    event.target._originalTitle = title;
    event.target.removeAttribute('title');
}

// Hide tooltip
function hideTooltip(event) {
    const tooltip = event.target._tooltip;
    if (tooltip) {
        tooltip.remove();
        event.target._tooltip = null;
    }

    // Restore title
    if (event.target._originalTitle) {
        event.target.setAttribute('title', event.target._originalTitle);
        event.target._originalTitle = null;
    }
}

// Check for application updates
function checkForUpdates() {
    // This would typically check a version endpoint
    // For now, just a placeholder
    console.log('Checking for updates...');

    // You could implement version checking here
    // const currentVersion = '1.0.0';
    // fetch('/api/version').then(...)
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Performance monitoring
function monitorPerformance() {
    // Monitor page load time
    window.addEventListener('load', () => {
        const loadTime = performance.now();
        console.log(`Page loaded in ${Math.round(loadTime)}ms`);

        // You could send this to analytics
        if (loadTime > 3000) {
            console.warn('Slow page load detected');
        }
    });

    // Monitor memory usage (if available)
    if (performance.memory) {
        setInterval(() => {
            const memory = performance.memory;
            const memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);

            if (memoryUsage > 100) { // 100MB
                console.warn('High memory usage detected:', memoryUsage + 'MB');
            }
        }, 60000); // Check every minute
    }
}

// Initialize performance monitoring
monitorPerformance();

// Handle offline/online status
function setupOfflineHandling() {
    function updateOnlineStatus() {
        if (navigator.onLine) {
            showNotification('Connection restored', 'success', 3000);
            // Retry any failed requests
            retryFailedRequests();
        } else {
            showNotification('You are offline. Some features may not work.', 'warning', 0);
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

// Retry failed requests
function retryFailedRequests() {
    // This would retry any requests that failed due to network issues
    console.log('Retrying failed requests...');
}

// Setup offline handling
setupOfflineHandling();

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const cityInput = document.getElementById('city');
            if (cityInput) {
                cityInput.focus();
            }
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal[style*="block"]');
            openModals.forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
}

// Setup keyboard shortcuts
setupKeyboardShortcuts();

// Browser compatibility checks
function checkBrowserCompatibility() {
    const requiredFeatures = [
        'fetch',
        'Promise',
        'localStorage',
        'sessionStorage',
        'addEventListener'
    ];

    const missingFeatures = requiredFeatures.filter(feature => !(feature in window));

    if (missingFeatures.length > 0) {
        console.warn('Missing browser features:', missingFeatures);
        showNotification(
            'Your browser may not support all features. Please update to a modern browser.',
            'warning',
            10000
        );
    }
}

// Check browser compatibility
checkBrowserCompatibility();

// Export utility functions for use in other modules
window.appUtils = {
    debounce,
    throttle,
    setupErrorHandling,
    checkGoogleMapsAPI,
    showTooltip,
    hideTooltip
};

console.log('App initialized successfully');