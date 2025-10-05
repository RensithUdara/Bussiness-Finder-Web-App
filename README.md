# Business Finder - Firebase Web Application

A fully serverless business finder application built with JavaScript and Firebase. Users can search for local businesses by city, type, and radius, with user management and admin features.

## 🌟 Features

### For Users
- **Business Search**: Search by city, business type, and radius (5km to 100km)
- **Interactive Map**: View results on Google Maps with markers and radius circle
- **User Authentication**: Sign up, sign in, password reset
- **Trial System**: Free searches with trial counter
- **Responsive Design**: Works on desktop, tablet, and mobile

### For Admins
- **User Management**: View, ban/unban, edit, and delete users
- **Search History**: Monitor all searches with filtering and export
- **IP Tracking**: Track and block suspicious IP addresses
- **Dashboard**: Statistics and analytics charts
- **Real-time Data**: Live updates of user activity

## 🚀 Quick Start

### Prerequisites
1. **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
2. **Firebase CLI** - Install with `npm install -g firebase-tools`
3. **Google Cloud Account** - For Firebase and Google Maps API
4. **Code Editor** - VS Code recommended

### Setup Instructions

#### 1. Clone and Install
```bash
# Navigate to your project directory
cd "G:\Bussiness Finder"

# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Install dependencies for Cloud Functions
cd functions
npm install
cd ..
```

#### 2. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter project name: `business-finder` (or your choice)
4. Disable Google Analytics (optional)
5. Wait for project creation

#### 3. Enable Firebase Services

**Firestore Database:**
1. Go to "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode"
4. Select location closest to your users

**Authentication:**
1. Go to "Build" → "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider

**Hosting:**
1. Go to "Build" → "Hosting"
2. Click "Get started"
3. Note the hosting URL for later

**Functions:**
1. Go to "Build" → "Functions"
2. Click "Get started"
3. Upgrade to Blaze plan (required for Cloud Functions)

#### 4. Get API Keys

**Firebase Configuration:**
1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click web icon (</>) to add a web app
4. Register app with name "Business Finder Web"
5. Copy the configuration object

**Google Maps API:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project
3. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Create API key in "Credentials"
5. Restrict the key to your domain and specific APIs

#### 5. Configure the Application

**Update Firebase Config:**
1. Open `public/js/firebase-config.js`
2. Replace the `firebaseConfig` object with your configuration:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

**Update Google Maps API Key:**
1. Open `public/index.html`
2. Find the Google Maps script tag
3. Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&libraries=places" async defer></script>
```

**Configure Cloud Functions:**
1. Set environment variables for Google API keys:

```bash
firebase functions:config:set google.places_api_key="YOUR_PLACES_API_KEY"
firebase functions:config:set google.geocoding_api_key="YOUR_GEOCODING_API_KEY"
```

#### 6. Initialize Firebase Project
```bash
# Initialize Firebase in your project directory
firebase init

# Select these options:
# - Firestore: Configure security rules and indexes files
# - Functions: Configure a Cloud Functions directory and files  
# - Hosting: Configure and deploy Firebase Hosting sites

# Choose "Use an existing project" and select your project
# Accept default settings for most prompts
# For hosting, set "public" as your public directory
# Configure as single-page app: No
```

#### 7. Deploy the Application
```bash
# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy Cloud Functions
firebase deploy --only functions

# Deploy hosting
firebase deploy --only hosting
```

#### 8. Create Admin User
After deployment, you'll need to manually create an admin user:

1. Sign up normally through your app
2. In Firebase Console, go to Firestore Database
3. Find your user document in the `users` collection
4. Edit the document and set `isAdmin: true`

## 📱 Usage Guide

### For Regular Users

**Searching for Businesses:**
1. Sign up or sign in to your account
2. Fill in the search form:
   - **City**: Enter any city name (e.g., "New York", "London")
   - **Business Type**: Select from dropdown (restaurants, gas stations, etc.)
   - **Radius**: Choose search radius (5km to 100km)
3. Click "Search Businesses"
4. View results on map and in the list
5. Click markers or cards for more details
6. Get directions to any business

**Managing Your Account:**
- View remaining trial searches in the top navigation
- Change password through login page "Forgot password" link
- Contact support when trials are exhausted

### For Administrators

**Accessing Admin Panel:**
1. Sign in with admin account
2. Navigate to `/admin.html` or add to your bookmark
3. Use the sidebar to switch between sections

**User Management:**
- View all registered users
- Search and filter users
- Ban/unban problematic users
- Edit user details and trial counts
- Delete users if necessary

**Monitoring Searches:**
- View all search history
- Filter by date, user, or location
- Export data to CSV
- View detailed search results

**IP Management:**
- Monitor IP addresses with multiple accounts
- Block suspicious IPs
- View all users from an IP address

## 🛠️ Customization

### Adding New Business Types
1. Update the select options in `public/index.html`
2. Add corresponding labels in `public/js/search.js` (`getBusinessTypeLabel` function)
3. Update admin panel labels in `public/js/admin.js`

### Changing Trial Limits
1. Update default trial count in `public/js/auth.js` (signup function)
2. Modify trial validation in `functions/index.js` (searchBusinesses function)

### Styling Customization
1. Modify colors in `public/css/styles.css` (`:root` variables)
2. Update component styles as needed
3. Add custom animations or effects

### Adding New Features
1. Create new HTML pages in `public/`
2. Add corresponding JavaScript files in `public/js/`
3. Update navigation and routing
4. Add new Cloud Functions if backend logic is needed

## 🔧 Development

### Local Development
```bash
# Start Firebase emulators
firebase emulators:start

# Your app will be available at:
# - Hosting: http://localhost:5000
# - Functions: http://localhost:5001
# - Firestore: http://localhost:8080
```

### Testing
1. Use Firebase emulator suite for testing
2. Test authentication flows
3. Test search functionality with sample data
4. Test admin features
5. Test on different devices and browsers

### Debugging
1. Check browser console for JavaScript errors
2. Monitor Firebase Functions logs: `firebase functions:log`
3. Use Firestore emulator UI for database inspection
4. Check network tab for API call issues

## 📊 Analytics and Monitoring

### Built-in Analytics
- User registration tracking
- Search frequency monitoring  
- IP usage analysis
- Business type popularity
- Geographic search patterns

### Adding Google Analytics (Optional)
1. Create Google Analytics property
2. Add tracking code to HTML pages
3. Set up conversion goals
4. Monitor user engagement

## 🔒 Security Features

### Authentication Security
- Email/password authentication via Firebase Auth
- Password strength validation
- Email verification (optional)
- Secure session management

### Database Security
- Firestore security rules prevent unauthorized access
- Users can only access their own data
- Admin-only collections and operations
- Input validation on all operations

### API Security
- Google API keys restricted to specific APIs and domains
- Server-side API calls to hide keys from frontend
- Rate limiting and abuse prevention
- IP blocking for malicious users

## 🚀 Deployment Options

### Firebase Hosting (Recommended)
- Automatic SSL certificates
- Global CDN
- Easy custom domain setup
- Atomic deployments

### Custom Domain Setup
1. In Firebase Console, go to Hosting
2. Click "Add custom domain"
3. Follow DNS configuration steps
4. SSL certificate automatically provisioned

### Multiple Environments
Create separate Firebase projects for:
- Development
- Staging  
- Production

## 📈 Scaling Considerations

### Performance Optimization
- Enable Firestore offline persistence
- Implement result caching
- Optimize images and assets
- Use Firebase Performance Monitoring

### Cost Management
- Monitor Google Places API usage
- Implement result caching to reduce API calls
- Set up billing alerts
- Consider pagination for large datasets

### High Traffic Handling
- Firebase automatically scales
- Monitor Cloud Functions execution time
- Consider upgrading to higher Firebase plan
- Implement proper error handling and retry logic

## 🔍 Troubleshooting

### Common Issues

**Google Maps not loading:**
- Check API key is correct and unrestricted for development
- Verify billing is enabled in Google Cloud
- Check browser console for specific errors

**Authentication issues:**
- Verify Firebase configuration is correct
- Check Firestore security rules
- Ensure user documents are created properly

**Search not working:**
- Verify Google Places API is enabled
- Check Cloud Functions logs for errors
- Confirm API keys are set in Functions config

**Admin panel access denied:**
- Verify user has `isAdmin: true` in Firestore
- Check authentication status
- Clear browser cache and cookies

### Getting Help
1. Check Firebase documentation
2. Review Google Maps API documentation
3. Search Firebase community forums
4. Check GitHub issues for similar problems

## 📝 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For support or questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation first

---

**Happy coding! 🎉**