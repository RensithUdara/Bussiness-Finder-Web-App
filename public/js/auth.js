// Authentication handling
// Wait for Firebase services to be initialized
function waitForFirebase() {
    return new Promise((resolve, reject) => {
        const checkFirebase = () => {
            if (window.firebaseApp && window.firebaseApp.auth && window.firebaseApp.db) {
                resolve(window.firebaseApp);
            } else {
                console.log('Waiting for Firebase initialization...');
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();

        // Timeout after 10 seconds
        setTimeout(() => {
            reject(new Error('Firebase initialization timeout'));
        }, 10000);
    });
}

// Helper to get auth service safely
async function getAuth() {
    const services = await waitForFirebase();
    return services.auth;
}

// Helper to get db service safely
async function getDb() {
    const services = await waitForFirebase();
    return services.db;
}

// Initialize authentication state listener
let currentUser = null;
let unsubscribeAuth = null;

// Set up auth state listener
async function initializeAuth() {
    if (unsubscribeAuth) {
        unsubscribeAuth();
    }

    try {
        const auth = await getAuth();
        unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            await handleAuthStateChange(user);
        });
    } catch (error) {
        console.error('Failed to initialize auth:', error);
    }
}

// Handle authentication state changes
async function handleAuthStateChange(user) {
    const authLinks = document.getElementById('authLinks');
    const trialCounter = document.getElementById('trialCounter');
    const authRequired = document.getElementById('authRequired');
    const searchForm = document.getElementById('searchForm');

    if (user) {
        // User is signed in
        try {
            // Check if user is banned
            const userData = await getUserData(user.uid);
            if (userData && userData.isBanned) {
                const auth = await getAuth();
                await auth.signOut();
                showNotification('Your account has been banned. Please contact support.', 'error');
                return;
            }

            // Update UI for authenticated user
            if (authLinks) {
                authLinks.innerHTML = `
                    <span class="user-info">
                        <i class="fas fa-user"></i>
                        ${userData?.username || user.email}
                    </span>
                    <button id="logoutBtn" class="nav-link logout-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                `;

                // Add logout functionality
                document.getElementById('logoutBtn').addEventListener('click', handleLogout);
            }

            // Show trial counter
            if (trialCounter && userData) {
                const trialCount = userData.trialCount || 0;
                document.getElementById('trialCount').textContent = `Trials remaining: ${trialCount}`;
                trialCounter.style.display = 'block';

                // Update counter styling based on remaining trials
                if (trialCount === 0) {
                    trialCounter.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
                } else if (trialCount === 1) {
                    trialCounter.style.background = 'linear-gradient(135deg, #ffc107, #e0a800)';
                }
            }

            // Hide auth required message
            if (authRequired) {
                authRequired.style.display = 'none';
            }

            // Enable search form
            if (searchForm) {
                searchForm.style.display = 'block';
            }

        } catch (error) {
            console.error('Error handling authenticated user:', error);
            showNotification('Error loading user data', 'error');
        }
    } else {
        // User is signed out
        if (authLinks) {
            authLinks.innerHTML = `
                <a href="login.html" class="nav-link">
                    <i class="fas fa-sign-in-alt"></i>
                    Sign In
                </a>
                <a href="signup.html" class="nav-link">
                    <i class="fas fa-user-plus"></i>
                    Sign Up
                </a>
            `;
        }

        // Hide trial counter
        if (trialCounter) {
            trialCounter.style.display = 'none';
        }

        // Show auth required message on main page
        if (authRequired && window.location.pathname.includes('index.html')) {
            authRequired.style.display = 'block';
        }

        // Hide search form
        if (searchForm) {
            searchForm.style.display = 'none';
        }
    }
}

// Handle user logout
async function handleLogout() {
    try {
        const auth = await getAuth();
        await auth.signOut();
        showNotification('Logged out successfully', 'success');

        // Redirect to home page if on admin page
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Error logging out', 'error');
    }
}

// Login page functionality
function initializeLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const forgotPasswordLink = document.getElementById('forgotPassword');
    const resetModal = document.getElementById('resetModal');
    const closeResetModal = document.getElementById('closeResetModal');
    const resetForm = document.getElementById('resetForm');

    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Handle forgot password
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            resetModal.style.display = 'block';
        });
    }

    // Handle reset modal close
    if (closeResetModal) {
        closeResetModal.addEventListener('click', () => {
            resetModal.style.display = 'none';
        });
    }

    // Handle password reset form
    if (resetForm) {
        resetForm.addEventListener('submit', handlePasswordReset);
    }

    // Close modal when clicking outside
    if (resetModal) {
        resetModal.addEventListener('click', (e) => {
            if (e.target === resetModal) {
                resetModal.style.display = 'none';
            }
        });
    }

    // Initialize auth
    initializeAuth();
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // Show loading state
    setButtonLoading(loginBtn, true);
    hideMessages();

    try {
        // Sign in user
        const auth = await getAuth();
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Check if user is banned
        const userData = await getUserData(user.uid);
        if (userData && userData.isBanned) {
            await auth.signOut();
            showError(errorMessage, 'Your account has been banned. Please contact support.');
            setButtonLoading(loginBtn, false);
            return;
        }

        // Update last login
        const db = await getDb();
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            lastLoginIP: 'client-ip' // This would be set by a Cloud Function
        });

        showSuccess(successMessage, 'Login successful! Redirecting...');

        // Redirect after short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        let errorMsg = 'Login failed. Please try again.';

        switch (error.code) {
            case 'auth/user-not-found':
                errorMsg = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                errorMsg = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Please enter a valid email address.';
                break;
            case 'auth/user-disabled':
                errorMsg = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMsg = 'Too many failed attempts. Please try again later.';
                break;
        }

        showError(errorMessage, errorMsg);
        setButtonLoading(loginBtn, false);
    }
}

// Handle password reset
async function handlePasswordReset(e) {
    e.preventDefault();

    const email = document.getElementById('resetEmail').value;
    const resetMessage = document.getElementById('resetMessage');

    try {
        const auth = await getAuth();
        await auth.sendPasswordResetEmail(email);
        showSuccess(resetMessage, 'Password reset email sent! Check your inbox.');

        // Close modal after delay
        setTimeout(() => {
            document.getElementById('resetModal').style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Password reset error:', error);
        let errorMsg = 'Failed to send reset email.';

        if (error.code === 'auth/user-not-found') {
            errorMsg = 'No account found with this email address.';
        }

        showError(resetMessage, errorMsg);
    }
}

// Signup page functionality
function initializeSignupPage() {
    const signupForm = document.getElementById('signupForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Handle signup form submission
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Handle password strength indicator
    if (passwordInput) {
        passwordInput.addEventListener('input', updatePasswordStrength);
    }

    // Handle password confirmation validation
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    }

    // Initialize auth
    initializeAuth();
}

// Handle signup form submission
async function handleSignup(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    const signupBtn = document.getElementById('signupBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    // Validate inputs
    if (!agreeTerms) {
        showError(errorMessage, 'Please agree to the Terms of Service and Privacy Policy.');
        return;
    }

    if (password !== confirmPassword) {
        showError(errorMessage, 'Passwords do not match.');
        return;
    }

    if (password.length < 8) {
        showError(errorMessage, 'Password must be at least 8 characters long.');
        return;
    }

    // Show loading state
    setButtonLoading(signupBtn, true);
    hideMessages();

    try {
        // Check if username is already taken
        const db = getDb();
        const usernameQuery = await db.collection('users')
            .where('username', '==', username)
            .limit(1)
            .get();

        if (!usernameQuery.empty) {
            showError(errorMessage, 'Username is already taken. Please choose another.');
            setButtonLoading(signupBtn, false);
            return;
        }

        // Create user account
        const auth = getAuth();
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            username: username,
            email: email,
            isAdmin: false,
            trialCount: 3, // Give users 3 free trials
            isBanned: false,
            registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
            registrationIP: 'client-ip', // This would be set by a Cloud Function
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            emailVerified: false
        });

        // Send email verification
        await user.sendEmailVerification();

        showSuccess(successMessage, 'Account created successfully! Please check your email to verify your account. Redirecting to login...');

        // Redirect after delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);

    } catch (error) {
        console.error('Signup error:', error);
        let errorMsg = 'Registration failed. Please try again.';

        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMsg = 'An account with this email already exists.';
                break;
            case 'auth/invalid-email':
                errorMsg = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                errorMsg = 'Password is too weak. Please use a stronger password.';
                break;
        }

        showError(errorMessage, errorMsg);
        setButtonLoading(signupBtn, false);
    }
}

// Update password strength indicator
function updatePasswordStrength() {
    const password = document.getElementById('password').value;
    const strengthIndicator = document.getElementById('strengthIndicator');
    const strengthText = document.getElementById('strengthText');

    let strength = 0;
    let feedback = '';

    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    switch (strength) {
        case 0:
        case 1:
            strengthIndicator.style.width = '20%';
            strengthIndicator.style.background = '#dc3545';
            feedback = 'Very weak';
            break;
        case 2:
            strengthIndicator.style.width = '40%';
            strengthIndicator.style.background = '#fd7e14';
            feedback = 'Weak';
            break;
        case 3:
            strengthIndicator.style.width = '60%';
            strengthIndicator.style.background = '#ffc107';
            feedback = 'Fair';
            break;
        case 4:
            strengthIndicator.style.width = '80%';
            strengthIndicator.style.background = '#28a745';
            feedback = 'Good';
            break;
        case 5:
            strengthIndicator.style.width = '100%';
            strengthIndicator.style.background = '#20c997';
            feedback = 'Strong';
            break;
    }

    strengthText.textContent = feedback;
}

// Validate password match
function validatePasswordMatch() {
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const confirmInput = document.getElementById('confirmPassword');

    if (confirmPassword && password !== confirmPassword) {
        confirmInput.setCustomValidity('Passwords do not match');
        confirmInput.style.borderColor = '#dc3545';
    } else {
        confirmInput.setCustomValidity('');
        confirmInput.style.borderColor = '#28a745';
    }
}

// Check if user is admin and redirect if not
async function requireAdmin() {
    const user = await getCurrentUser();

    if (!user) {
        window.location.href = 'login.html';
        return false;
    }

    const isAdmin = await checkAdminStatus(user);
    if (!isAdmin) {
        showNotification('Access denied. Admin privileges required.', 'error');
        window.location.href = 'index.html';
        return false;
    }

    return true;
}

// Utility functions
function setButtonLoading(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const btnSpinner = button.querySelector('.btn-spinner');

    if (loading) {
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'block';
        button.disabled = true;
    } else {
        if (btnText) btnText.style.display = 'block';
        if (btnSpinner) btnSpinner.style.display = 'none';
        button.disabled = false;
    }
}

function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function showSuccess(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function hideMessages() {
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');

    if (errorMessage) errorMessage.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';
}

// Get user data from Firestore
async function getUserData(uid) {
    try {
        const db = getDb();
        const userDoc = await db.collection('users').doc(uid).get();
        return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// Initialize auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize auth if not on specific pages that handle it themselves
    if (!window.location.pathname.includes('login.html') &&
        !window.location.pathname.includes('signup.html') &&
        !window.location.pathname.includes('admin.html')) {
        initializeAuth();
    }
});

// Export functions for use in other modules
window.authModule = {
    initializeAuth,
    handleLogout,
    requireAdmin,
    initializeLoginPage,
    initializeSignupPage,
    getCurrentUser: () => currentUser
};