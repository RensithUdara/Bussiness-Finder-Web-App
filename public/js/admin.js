// Admin panel functionality
const { auth, db, functions } = window.firebaseApp;

let currentTab = 'dashboard';
let usersData = [];
let searchesData = [];
let ipData = [];
let currentPage = 1;
const itemsPerPage = 20;

// Initialize admin panel
async function initializeAdminPage() {
    // Check admin access
    const hasAccess = await window.authModule.requireAdmin();
    if (!hasAccess) return;
    
    // Initialize auth state
    window.authModule.initializeAuth();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    await loadDashboardData();
    
    // Show dashboard tab by default
    showTab('dashboard');
}

// Set up event listeners
function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const tab = e.currentTarget.getAttribute('data-tab');
            showTab(tab);
        });
    });
    
    // User management
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', filterUsers);
    }
    
    const userFilter = document.getElementById('userFilter');
    if (userFilter) {
        userFilter.addEventListener('change', filterUsers);
    }
    
    // Pagination
    document.getElementById('prevUsers')?.addEventListener('click', () => changePage('users', -1));
    document.getElementById('nextUsers')?.addEventListener('click', () => changePage('users', 1));
    document.getElementById('prevSearches')?.addEventListener('click', () => changePage('searches', -1));
    document.getElementById('nextSearches')?.addEventListener('click', () => changePage('searches', 1));
    
    // Bulk actions
    document.getElementById('selectAllUsers')?.addEventListener('change', toggleSelectAll);
    document.getElementById('bulkBan')?.addEventListener('click', handleBulkBan);
    document.getElementById('bulkDelete')?.addEventListener('click', handleBulkDelete);
    
    // Export
    document.getElementById('exportSearches')?.addEventListener('click', exportSearchHistory);
    
    // Modal close handlers
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    // Edit user form
    document.getElementById('editUserForm')?.addEventListener('submit', handleUserUpdate);
}

// Show specific tab
async function showTab(tabName) {
    // Update sidebar
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    currentTab = tabName;
    
    // Load tab-specific data
    switch (tabName) {
        case 'dashboard':
            await loadDashboardData();
            break;
        case 'users':
            await loadUsersData();
            break;
        case 'searches':
            await loadSearchesData();
            break;
        case 'ip-usage':
            await loadIPData();
            break;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        showLoadingState('dashboard');
        
        // Get statistics
        const [usersSnapshot, searchesSnapshot, bannedUsersSnapshot] = await Promise.all([
            db.collection('users').get(),
            db.collection('searches').get(),
            db.collection('users').where('isBanned', '==', true).get()
        ]);
        
        // Calculate today's searches
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySearches = searchesSnapshot.docs.filter(doc => {
            const timestamp = doc.data().timestamp;
            if (!timestamp) return false;
            const searchDate = timestamp.toDate();
            return searchDate >= today;
        }).length;
        
        // Update statistics
        document.getElementById('totalUsers').textContent = usersSnapshot.size;
        document.getElementById('totalSearches').textContent = searchesSnapshot.size;
        document.getElementById('todaySearches').textContent = todaySearches;
        document.getElementById('bannedUsers').textContent = bannedUsersSnapshot.size;
        
        // Generate charts
        generateBusinessTypeChart(searchesSnapshot.docs);
        generateCityChart(searchesSnapshot.docs);
        
        hideLoadingState('dashboard');
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Error loading dashboard data', 'error');
        hideLoadingState('dashboard');
    }
}

// Load users data
async function loadUsersData() {
    try {
        showLoadingState('users');
        
        const snapshot = await db.collection('users').orderBy('registrationDate', 'desc').get();
        usersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayUsers();
        hideLoadingState('users');
        
    } catch (error) {
        console.error('Error loading users data:', error);
        showNotification('Error loading users data', 'error');
        hideLoadingState('users');
    }
}

// Display users in table
function displayUsers(filteredData = null) {
    const data = filteredData || usersData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = data.slice(startIndex, endIndex);
    
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    pageData.forEach(user => {
        const row = createUserRow(user);
        tbody.appendChild(row);
    });
    
    // Update pagination
    updatePagination('users', data.length);
}

// Create user table row
function createUserRow(user) {
    const row = document.createElement('tr');
    
    const statusBadges = [];
    if (user.isAdmin) statusBadges.push('<span class="badge badge-admin">Admin</span>');
    if (user.isBanned) statusBadges.push('<span class="badge badge-banned">Banned</span>');
    if (!user.isBanned && !user.isAdmin) statusBadges.push('<span class="badge badge-active">Active</span>');
    
    row.innerHTML = `
        <td><input type="checkbox" class="user-checkbox" data-user-id="${user.id}"></td>
        <td>${escapeHtml(user.username || 'N/A')}</td>
        <td>${escapeHtml(user.email || 'N/A')}</td>
        <td>${statusBadges.join(' ')}</td>
        <td>${user.trialCount || 0}</td>
        <td>${formatDate(user.registrationDate)}</td>
        <td>${formatDate(user.lastLogin)}</td>
        <td>
            <div class="action-buttons">
                <button class="btn btn-primary btn-sm" onclick="editUser('${user.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn ${user.isBanned ? 'btn-success' : 'btn-warning'} btn-sm" 
                        onclick="${user.isBanned ? 'unbanUser' : 'banUser'}('${user.id}')">
                    <i class="fas ${user.isBanned ? 'fa-check' : 'fa-ban'}"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Filter users
function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filterType = document.getElementById('userFilter').value;
    
    let filtered = usersData.filter(user => {
        const matchesSearch = user.username?.toLowerCase().includes(searchTerm) || 
                             user.email?.toLowerCase().includes(searchTerm);
        
        let matchesFilter = true;
        switch (filterType) {
            case 'admin':
                matchesFilter = user.isAdmin === true;
                break;
            case 'banned':
                matchesFilter = user.isBanned === true;
                break;
            case 'active':
                matchesFilter = !user.isBanned && !user.isAdmin;
                break;
        }
        
        return matchesSearch && matchesFilter;
    });
    
    currentPage = 1; // Reset to first page
    displayUsers(filtered);
}

// Edit user
window.editUser = function(userId) {
    const user = usersData.find(u => u.id === userId);
    if (!user) return;
    
    // Populate form
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editTrialCount').value = user.trialCount || 0;
    document.getElementById('editIsAdmin').checked = user.isAdmin || false;
    
    // Show modal
    document.getElementById('editUserModal').style.display = 'block';
};

// Handle user update
async function handleUserUpdate(e) {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const username = document.getElementById('editUsername').value;
    const email = document.getElementById('editEmail').value;
    const trialCount = parseInt(document.getElementById('editTrialCount').value);
    const isAdmin = document.getElementById('editIsAdmin').checked;
    
    try {
        await db.collection('users').doc(userId).update({
            username,
            email,
            trialCount,
            isAdmin,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('User updated successfully', 'success');
        document.getElementById('editUserModal').style.display = 'none';
        await loadUsersData();
        
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user', 'error');
    }
}

// Ban user
window.banUser = async function(userId) {
    if (!confirm('Are you sure you want to ban this user?')) return;
    
    try {
        await db.collection('users').doc(userId).update({
            isBanned: true,
            bannedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('User banned successfully', 'success');
        await loadUsersData();
        
    } catch (error) {
        console.error('Error banning user:', error);
        showNotification('Error banning user', 'error');
    }
};

// Unban user
window.unbanUser = async function(userId) {
    if (!confirm('Are you sure you want to unban this user?')) return;
    
    try {
        await db.collection('users').doc(userId).update({
            isBanned: false,
            unbannedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showNotification('User unbanned successfully', 'success');
        await loadUsersData();
        
    } catch (error) {
        console.error('Error unbanning user:', error);
        showNotification('Error unbanning user', 'error');
    }
};

// Delete user
window.deleteUser = async function(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        // Delete user document
        await db.collection('users').doc(userId).delete();
        
        // You might also want to delete associated searches
        const searchesSnapshot = await db.collection('searches').where('userId', '==', userId).get();
        const batch = db.batch();
        searchesSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        showNotification('User deleted successfully', 'success');
        await loadUsersData();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showNotification('Error deleting user', 'error');
    }
};

// Load searches data
async function loadSearchesData() {
    try {
        showLoadingState('searches');
        
        const snapshot = await db.collection('searches').orderBy('timestamp', 'desc').limit(500).get();
        
        // Get user data for each search
        const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))];
        const userPromises = userIds.map(uid => db.collection('users').doc(uid).get());
        const userDocs = await Promise.all(userPromises);
        
        const userMap = {};
        userDocs.forEach(doc => {
            if (doc.exists) {
                userMap[doc.id] = doc.data();
            }
        });
        
        searchesData = snapshot.docs.map(doc => {
            const data = doc.data();
            const user = userMap[data.userId];
            return {
                id: doc.id,
                ...data,
                username: user?.username || 'Unknown'
            };
        });
        
        displaySearches();
        hideLoadingState('searches');
        
    } catch (error) {
        console.error('Error loading searches data:', error);
        showNotification('Error loading searches data', 'error');
        hideLoadingState('searches');
    }
}

// Display searches in table
function displaySearches() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = searchesData.slice(startIndex, endIndex);
    
    const tbody = document.getElementById('searchesTableBody');
    tbody.innerHTML = '';
    
    pageData.forEach(search => {
        const row = createSearchRow(search);
        tbody.appendChild(row);
    });
    
    // Update pagination
    updatePagination('searches', searchesData.length);
}

// Create search table row
function createSearchRow(search) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>${escapeHtml(search.username)}</td>
        <td>${escapeHtml(search.city || 'N/A')}</td>
        <td>${escapeHtml(search.businessType || 'N/A')}</td>
        <td>${search.radiusKm || 'N/A'} km</td>
        <td>${search.resultsCount || 0}</td>
        <td>${formatDate(search.timestamp)}</td>
        <td>${search.ipAddress || 'N/A'}</td>
        <td>
            <button class="btn btn-primary btn-sm" onclick="viewSearchResults('${search.id}')">
                <i class="fas fa-eye"></i>
            </button>
        </td>
    `;
    
    return row;
}

// View search results
window.viewSearchResults = async function(searchId) {
    try {
        const resultsSnapshot = await db.collection('searches').doc(searchId).collection('results').get();
        const results = resultsSnapshot.docs.map(doc => doc.data());
        
        const content = document.getElementById('searchResultsContent');
        content.innerHTML = `
            <h4>Search Results (${results.length} businesses found)</h4>
            <div class="search-results-list">
                ${results.map(business => `
                    <div class="result-item" style="border: 1px solid #dee2e6; padding: 1rem; margin-bottom: 1rem; border-radius: 4px;">
                        <h5>${escapeHtml(business.name)}</h5>
                        <p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(business.address || 'Address not available')}</p>
                        ${business.phone ? `<p><i class="fas fa-phone"></i> ${escapeHtml(business.phone)}</p>` : ''}
                        ${business.rating ? `<p><i class="fas fa-star"></i> ${business.rating} stars (${business.totalReviews || 0} reviews)</p>` : ''}
                        ${business.distance ? `<p><i class="fas fa-route"></i> ${business.distance} km away</p>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        document.getElementById('searchResultsModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading search results:', error);
        showNotification('Error loading search results', 'error');
    }
};

// Load IP data
async function loadIPData() {
    try {
        showLoadingState('ip-usage');
        
        const snapshot = await db.collection('ipUsage').orderBy('accountCount', 'desc').get();
        ipData = snapshot.docs.map(doc => ({
            ip: doc.id,
            ...doc.data()
        }));
        
        displayIPData();
        hideLoadingState('ip-usage');
        
    } catch (error) {
        console.error('Error loading IP data:', error);
        showNotification('Error loading IP data', 'error');
        hideLoadingState('ip-usage');
    }
}

// Display IP data in table
function displayIPData() {
    const tbody = document.getElementById('ipTableBody');
    tbody.innerHTML = '';
    
    ipData.forEach(ip => {
        const row = createIPRow(ip);
        tbody.appendChild(row);
    });
}

// Create IP table row
function createIPRow(ip) {
    const row = document.createElement('tr');
    
    // Highlight suspicious IPs
    if (ip.accountCount > 3) {
        row.style.backgroundColor = '#fff3cd';
    }
    
    const statusBadge = ip.isBlocked ? 
        '<span class="badge badge-blocked">Blocked</span>' : 
        (ip.accountCount > 3 ? '<span class="badge badge-suspicious">Suspicious</span>' : '<span class="badge badge-active">Normal</span>');
    
    row.innerHTML = `
        <td>${escapeHtml(ip.ip)}</td>
        <td>${ip.accountCount || 0}</td>
        <td>${formatDate(ip.firstSeen)}</td>
        <td>${formatDate(ip.lastSeen)}</td>
        <td>${statusBadge}</td>
        <td>
            <div class="action-buttons">
                <button class="btn ${ip.isBlocked ? 'btn-success' : 'btn-danger'} btn-sm" 
                        onclick="${ip.isBlocked ? 'unblockIP' : 'blockIP'}('${ip.ip}')">
                    <i class="fas ${ip.isBlocked ? 'fa-check' : 'fa-ban'}"></i>
                    ${ip.isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button class="btn btn-info btn-sm" onclick="viewIPUsers('${ip.ip}')">
                    <i class="fas fa-users"></i>
                    Users
                </button>
            </div>
        </td>
    `;
    
    return row;
}

// Generate business type chart
function generateBusinessTypeChart(searches) {
    const businessTypeCounts = {};
    
    searches.forEach(doc => {
        const businessType = doc.data().businessType;
        if (businessType) {
            businessTypeCounts[businessType] = (businessTypeCounts[businessType] || 0) + 1;
        }
    });
    
    const chartContainer = document.getElementById('businessTypeChart');
    const sortedTypes = Object.entries(businessTypeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    chartContainer.innerHTML = `
        <div class="simple-chart">
            ${sortedTypes.map(([type, count]) => `
                <div class="chart-item">
                    <div class="chart-label">${getBusinessTypeLabel(type)}</div>
                    <div class="chart-bar">
                        <div class="chart-fill" style="width: ${(count / sortedTypes[0][1]) * 100}%"></div>
                    </div>
                    <div class="chart-value">${count}</div>
                </div>
            `).join('')}
        </div>
        
        <style>
            .simple-chart { display: flex; flex-direction: column; gap: 0.5rem; }
            .chart-item { display: flex; align-items: center; gap: 1rem; }
            .chart-label { min-width: 120px; font-size: 0.9rem; }
            .chart-bar { flex: 1; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; }
            .chart-fill { height: 100%; background: linear-gradient(90deg, #007bff, #0056b3); }
            .chart-value { min-width: 30px; text-align: right; font-weight: 600; }
        </style>
    `;
}

// Generate city chart
function generateCityChart(searches) {
    const cityCounts = {};
    
    searches.forEach(doc => {
        const city = doc.data().city;
        if (city) {
            cityCounts[city] = (cityCounts[city] || 0) + 1;
        }
    });
    
    const chartContainer = document.getElementById('cityChart');
    const sortedCities = Object.entries(cityCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    
    chartContainer.innerHTML = `
        <div class="simple-chart">
            ${sortedCities.map(([city, count]) => `
                <div class="chart-item">
                    <div class="chart-label">${escapeHtml(city)}</div>
                    <div class="chart-bar">
                        <div class="chart-fill" style="width: ${(count / sortedCities[0][1]) * 100}%; background: linear-gradient(90deg, #28a745, #20c997);"></div>
                    </div>
                    <div class="chart-value">${count}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// Export search history
function exportSearchHistory() {
    const csvContent = [
        ['Username', 'City', 'Business Type', 'Radius (km)', 'Results', 'Date', 'IP Address'],
        ...searchesData.map(search => [
            search.username,
            search.city || '',
            search.businessType || '',
            search.radiusKm || '',
            search.resultsCount || 0,
            formatDate(search.timestamp),
            search.ipAddress || ''
        ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Utility functions
function changePage(type, direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    
    if (type === 'users') {
        displayUsers();
    } else if (type === 'searches') {
        displaySearches();
    }
}

function updatePagination(type, totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pageInfo = document.getElementById(`${type}PageInfo`);
    const prevBtn = document.getElementById(`prev${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const nextBtn = document.getElementById(`next${type.charAt(0).toUpperCase() + type.slice(1)}`);
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
}

function showLoadingState(section) {
    const content = document.getElementById(section);
    if (content) {
        content.style.opacity = '0.5';
        content.style.pointerEvents = 'none';
    }
}

function hideLoadingState(section) {
    const content = document.getElementById(section);
    if (content) {
        content.style.opacity = '1';
        content.style.pointerEvents = 'auto';
    }
}

// Get business type label (same as in search.js)
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

// Escape HTML (same as in other files)
function escapeHtml(text) {
    if (!text) return 'N/A';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Export admin module
window.adminModule = {
    initializeAdminPage,
    showTab,
    loadDashboardData,
    loadUsersData,
    loadSearchesData,
    loadIPData
};