require('dotenv').config(); //To load the .env file

// ========================================
// SERVER SETUP AND DEPENDENCIES
// ========================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

// ========================================
// APP CONFIGURATION
// ========================================
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'aa7d60331b8a920f71b4b171bd9dbe228808c54dd715e97d69d8719d87ed142b4271079b2a325b715a082dc195a08c1b18d0be8041e36ab30bdc67a3c3c30681';

// ========================================
// DATABASE CONNECTION
// ========================================
let db;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://notoadmin:<db_password>@noto.zm20mud.mongodb.net/?appName=noto';
const DB_NAME = 'noto';

// ========================================
// MIDDLEWARE CONFIGURATION
// ========================================
// Enables CORS for all routes with origin checking
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:5500', 'file://'];

app.use(cors({
    origin: function (origin, callback) {
        // Allows requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true
}));
app.use(express.json());

// ========================================
// STATIC FILE SERVING
// ========================================
// Serves static files (HTML, CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname)));

// Serves Assets folder
app.use('/Assets', express.static(path.join(__dirname, 'Assets')));

// ========================================
// SESSION CONFIGURATION
// ========================================
// Configures session for OAuth authentication
app.use(session({
    secret: process.env.SESSION_SECRET || JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// ========================================
// AUTHENTICATION MIDDLEWARE
// ========================================
// Middleware to verify JWT token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Checks if user is banned
        if (!isDBConnected()) {
            return res.status(503).json({ error: 'Database not connected' });
        }
        
        try {
            const userDoc = await db.collection('users').findOne({ _id: new ObjectId(user.userId) });
            if (!userDoc) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            if (userDoc.banned) {
                return res.status(403).json({ error: 'User account has been banned' });
            }
            
            req.user = user;
            next();
        } catch (dbError) {
            console.error('Database error during authentication:', dbError);
            return res.status(500).json({ error: 'Authentication error' });
        }
    });
}

// ========================================
// DATABASE CONNECTION
// ========================================
// Connects to MongoDB
async function connectDB() {
    // Checks if connection string is still a placeholder
    if (MONGODB_URI.includes('username:password@cluster.mongodb.net')) {
        console.warn('⚠️  MongoDB connection string not configured!');
        console.warn('Please set MONGODB_URI in .env file or update server.js');
        console.warn('Server will start but authentication features will not work.');
        return;
    }

    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('Server will start but authentication features will not work.');
    }
}

connectDB();

// Helper to check if DB is connected
function isDBConnected() {
    return db !== undefined;
}

// Spotify API credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '2630ad80437d419baa8155ca4a2716cb';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '9c362838dc744faca4364d99644b10ce';

// Last.fm API key (you'll need to get this from https://www.last.fm/api/account/create)
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '620513c3dd4e494e882396f862908153';

// Cache for access token
let accessToken = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
    // Return cached token if still valid
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: SPOTIFY_CLIENT_ID,
            client_secret: SPOTIFY_CLIENT_SECRET,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to get Spotify token: ' + response.status);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
    
    return accessToken;
}

// ========================================
// SPOTIFY API ENDPOINTS
// ========================================

// Proxy endpoint for Spotify search
app.get('/api/spotify/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Missing query parameter' });
        }

        const token = await getSpotifyToken();
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10&market=PH`;
        
        const response = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Spotify search failed: ' + response.status);
        }

        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Spotify audio features
app.get('/api/spotify/audio-features/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const token = await getSpotifyToken();
        const featuresUrl = `https://api.spotify.com/v1/audio-features/${id}`;
        
        const response = await fetch(featuresUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Spotify audio features failed: ' + response.status);
        }

        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// LAST.FM API ENDPOINTS
// ========================================
// Last.fm API endpoints for artist context
app.get('/api/lastfm/artist/:artistName', async (req, res) => {
    try {
        const { artistName } = req.params;
        if (!artistName) {
            return res.status(400).json({ error: 'Missing artist name' });
        }

        // Get artist info and top tags from Last.fm
        const [artistInfo, topTags] = await Promise.all([
            fetchLastfmArtistInfo(artistName),
            fetchLastfmTopTags(artistName)
        ]);

        res.json({
            artistInfo,
            topTags
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to fetch Last.fm artist info
async function fetchLastfmArtistInfo(artistName) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Last.fm artist info failed: ' + response.status);
    }
    
    const data = await response.json();
    return data.artist || null;
}

// Helper function to fetch Last.fm top tags
async function fetchLastfmTopTags(artistName) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Last.fm top tags failed: ' + response.status);
    }
    
    const data = await response.json();
    return data.toptags?.tag || [];
}

// Proxy endpoint for Spotify token generation
app.post('/api/spotify/token', async (req, res) => {
    try {
        const token = await getSpotifyToken();
        res.json({ access_token: token });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get track preview URL (if available)
app.get('/api/spotify/track/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const token = await getSpotifyToken();
        const trackUrl = `https://api.spotify.com/v1/tracks/${id}`;
        
        const response = await fetch(trackUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Spotify track request failed: ' + response.status);
        }

        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// AUTHENTICATION ENDPOINTS
// ========================================
// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Identifier and password required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user already exists (by email or username)
        const isEmail = identifier.includes('@');
        const query = isEmail ? { email: identifier.toLowerCase() } : { username: identifier.toLowerCase() };
        
        const existingUser = await db.collection('users').findOne(query);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = {
            username: isEmail ? null : identifier.toLowerCase(),
            email: isEmail ? identifier.toLowerCase() : null,
            password: hashedPassword,
            createdAt: new Date()
        };

        const result = await db.collection('users').insertOne(user);
        const userId = result.insertedId.toString();

        // Generate JWT token
        const token = jwt.sign({ userId, identifier }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: userId,
                identifier
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: 'Identifier and password required' });
        }

        // Find user by email or username
        const isEmail = identifier.includes('@');
        const query = isEmail ? { email: identifier.toLowerCase() } : { username: identifier.toLowerCase() };
        
        const user = await db.collection('users').findOne(query);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user._id.toString(), identifier }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user._id.toString(),
                identifier: user.email || user.username
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ========================================
// USER PROFILE ENDPOINTS
// ========================================
// Update username endpoint
app.put('/api/user/username', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { username } = req.body;
        const userId = req.user.userId;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Validate username
        if (username.trim().length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        const trimmedUsername = username.trim().toLowerCase();

        // Check if username is already taken by another user
        const existingUser = await db.collection('users').findOne({
            username: trimmedUsername,
            _id: { $ne: new ObjectId(userId) }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        // Update username
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { username: trimmedUsername, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Username updated successfully', username: trimmedUsername });
    } catch (error) {
        console.error('Update username error:', error);
        res.status(500).json({ error: 'Failed to update username' });
    }
});

// Update email endpoint
app.put('/api/user/email', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { email } = req.body;
        const userId = req.user.userId;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }

        const trimmedEmail = email.trim().toLowerCase();

        // Check if email is already taken by another user
        const existingUser = await db.collection('users').findOne({
            email: trimmedEmail,
            _id: { $ne: new ObjectId(userId) }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered' });
        }

        // Update email
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { email: trimmedEmail, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Email updated successfully', email: trimmedEmail });
    } catch (error) {
        console.error('Update email error:', error);
        res.status(500).json({ error: 'Failed to update email' });
    }
});

// Update password endpoint
app.put('/api/user/password', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { password } = req.body;
        const userId = req.user.userId;

        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        // Validate password
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// ========================================
// ADMIN ENDPOINTS
// ========================================

// Gets all users (admin only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const userId = req.user.userId;
        
        const users = await db.collection('users').find({}, {
            projection: {
                password: 0, // Excludes password field
                googleId: 0  // Excludes Google ID for privacy
            }
        }).sort({ createdAt: -1 }).toArray();

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// Suspends user (admin only)
app.put('/api/admin/users/:userId/suspend', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { userId } = req.params;
        
        // Updates user to add suspended status
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    suspended: true, 
                    suspendedAt: new Date(),
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User suspended successfully' });
    } catch (error) {
        console.error('Suspend user error:', error);
        res.status(500).json({ error: 'Failed to suspend user' });
    }
});

// Unsuspends user (admin only)
app.put('/api/admin/users/:userId/unsuspend', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { userId } = req.params;
        
        // Updates user to remove suspended status
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    suspended: false, 
                    unsuspendedAt: new Date(),
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User unsuspended successfully' });
    } catch (error) {
        console.error('Unsuspend user error:', error);
        res.status(500).json({ error: 'Failed to unsuspend user' });
    }
});

// Bans user (admin only)
app.put('/api/admin/users/:userId/ban', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { userId } = req.params;
        
        // Updates user to add banned status
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    banned: true, 
                    bannedAt: new Date(),
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User banned successfully' });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: 'Failed to ban user' });
    }
});

// ==================== GOOGLE OAUTH ====================

// Google OAuth credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback';

// Configure Google OAuth Strategy
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            if (!isDBConnected()) {
                return done(new Error('Database not connected'), null);
            }

            // Check if user exists by Google ID
            let user = await db.collection('users').findOne({ googleId: profile.id });

            if (user) {
                // User exists, return it
                return done(null, user);
            } else {
                // Check if user exists by email
                if (profile.emails && profile.emails[0]) {
                    user = await db.collection('users').findOne({ email: profile.emails[0].value.toLowerCase() });
                }

                if (user) {
                    // Update existing user with Google ID
                    await db.collection('users').updateOne(
                        { _id: user._id },
                        { $set: { googleId: profile.id } }
                    );
                    return done(null, user);
                } else {
                    // Create new user
                    const newUser = {
                        googleId: profile.id,
                        email: profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null,
                        username: profile.displayName ? profile.displayName.toLowerCase().replace(/\s+/g, '') : null,
                        displayName: profile.displayName || null,
                        photo: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
                        createdAt: new Date()
                    };

                    const result = await db.collection('users').insertOne(newUser);
                    newUser._id = result.insertedId;
                    return done(null, newUser);
                }
            }
        } catch (error) {
            return done(error, null);
        }
    }));

    // Serialize user for session
    passport.serializeUser((user, done) => {
        done(null, user._id.toString());
    });

    // Deserialize user from session
    passport.deserializeUser(async (id, done) => {
        try {
            if (!isDBConnected()) {
                return done(new Error('Database not connected'), null);
            }
            const user = await db.collection('users').findOne({ _id: new ObjectId(id) });
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });

    // Google OAuth routes
    app.get('/auth/google',
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login.html?error=google_auth_failed' }),
        async (req, res) => {
            try {
                const user = req.user;
                if (!user) {
                    return res.redirect('/login.html?error=user_not_found');
                }

                // Generate JWT token
                const identifier = user.email || user.username || user.googleId;
                const token = jwt.sign(
                    { userId: user._id.toString(), identifier },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                // Redirect to dashboard with token in URL (will be handled by frontend)
                res.redirect(`/dashboard.html?token=${token}&user=${encodeURIComponent(JSON.stringify({
                    id: user._id.toString(),
                    identifier: identifier
                }))}`);
            } catch (error) {
                console.error('Google OAuth callback error:', error);
                res.redirect('/login.html?error=oauth_error');
            }
        }
    );
} else {
    console.warn('⚠️  Google OAuth not configured!');
    console.warn('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
    
    // Fallback route to show error
    app.get('/auth/google', (req, res) => {
        res.status(503).json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file' });
    });
}

// ========================================
// SAVED SONGS ENDPOINTS
// ========================================
// Save a song
app.post('/api/songs/save', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { trackId, title, artist, albumImage } = req.body;
        const userId = req.user.userId;

        if (!trackId || !title || !artist) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if song already saved
        const existing = await db.collection('savedSongs').findOne({
            userId,
            trackId
        });

        if (existing) {
            return res.status(400).json({ error: 'Song already saved' });
        }

        const song = {
            userId,
            trackId,
            title,
            artist,
            albumImage: albumImage || null,
            savedAt: new Date()
        };

        await db.collection('savedSongs').insertOne(song);
        res.json({ message: 'Song saved successfully', song });
    } catch (error) {
        console.error('Save song error:', error);
        res.status(500).json({ error: 'Failed to save song' });
    }
});

// Get all saved songs for user
app.get('/api/songs/saved', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const userId = req.user.userId;
        const songs = await db.collection('savedSongs')
            .find({ userId })
            .sort({ savedAt: -1 })
            .toArray();

        res.json(songs);
    } catch (error) {
        console.error('Get saved songs error:', error);
        res.status(500).json({ error: 'Failed to get saved songs' });
    }
});

// Delete a saved song
app.delete('/api/songs/:trackId', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { trackId } = req.params;
        const userId = req.user.userId;

        const result = await db.collection('savedSongs').deleteOne({
            userId,
            trackId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Song not found' });
        }

        res.json({ message: 'Song deleted successfully' });
    } catch (error) {
        console.error('Delete song error:', error);
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

// Check if song is saved
app.get('/api/songs/check/:trackId', authenticateToken, async (req, res) => {
    if (!isDBConnected()) {
        return res.status(503).json({ error: 'Database not connected. Please configure MongoDB.' });
    }
    try {
        const { trackId } = req.params;
        const userId = req.user.userId;

        const song = await db.collection('savedSongs').findOne({
            userId,
            trackId
        });

        res.json({ isSaved: !!song });
    } catch (error) {
        console.error('Check song error:', error);
        res.status(500).json({ error: 'Failed to check song' });
    }
});

// ========================================
// CONFIGURATION ENDPOINTS
// ========================================

// Gets configuration for frontend
app.get('/api/config', (req, res) => {
    res.json({
        apiBaseUrl: process.env.API_BASE_URL || (req.protocol + '://' + req.get('host')),
        environment: process.env.NODE_ENV || 'development'
    });
});

// ========================================
// CLIENT-SIDE ROUTING
// ========================================
// Catch-all handler for client-side routing
app.get('*', (req, res) => {
    // Doesn't serve HTML for API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Serves index.html for all other routes (for SPA routing if needed)
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================================
// SERVER STARTUP
// ========================================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
