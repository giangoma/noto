// ========================================
// DASHBOARD FUNCTIONALITY
// ========================================
// Manages saved songs for dashboard display
let savedSongs = [];

// ========================================
// THEME CONFIGURATIONS
// ========================================
// Defines all available color themes with gradients and accent colors
const themes = {
    purple: {
        gradient: 'radial-gradient(ellipse at top left, #E6E6FA, #9370DB, #4B0082, #2F2F2F)',
        accent: '#9370DB'
    },
    blue: {
        gradient: 'radial-gradient(ellipse at top left, #2C3E50, #34495E, #1A252F, #2F2F2F)',
        accent: '#4A90A4'
    },
    green: {
        gradient: 'radial-gradient(ellipse at top left, #2D4A2D, #3A5A3A, #1F3A1F, #2F2F2F)',
        accent: '#5A8A5A'
    },
    red: {
        gradient: 'radial-gradient(ellipse at top left, #4A2C2C, #5A3A3A, #3A1F1F, #2F2F2F)',
        accent: '#8A5A5A'
    },
    orange: {
        gradient: 'radial-gradient(ellipse at top left, #4A3A2C, #5A4A3A, #3A2F1F, #2F2F2F)',
        accent: '#B88A5A'
    },
    pink: {
        gradient: 'radial-gradient(ellipse at top left, #4A2C3A, #5A3A4A, #3A1F2F, #2F2F2F)',
        accent: '#A85A7A'
    },
    hmhas: {
        gif: './Assets/HMHAS.gif',
        accent: '#909485'
    },
    sabrina: {
        video: './Assets/sabrina.mp4',
        accent: '#FF4444'
    }
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
// Gets current user object from localStorage
function getCurrentUser() {
    const userStr = localStorage.getItem('noto_user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('Error parsing noto_user from localStorage', e);
        return null;
    }
}

// Builds a stable per-user theme storage key
function getUserThemeStorageKey() {
    const user = getCurrentUser();
    if (!user) return 'noto_theme_guest';

    const identifier =
        user.id ||
        user._id ||
        user.email ||
        user.username ||
        user.identifier;

    return identifier ? `noto_theme_${identifier}` : 'noto_theme_guest';
}

// Gets storage key for user's profile picture
function getUserProfilePictureKey() {
    const user = getCurrentUser();
    if (!user) return 'noto_profile_picture_guest';

    const identifier =
        user.id ||
        user._id ||
        user.email ||
        user.username ||
        user.identifier;

    return identifier ? `noto_profile_picture_${identifier}` : 'noto_profile_picture_guest';
}

// Gets user's profile picture (returns base64 data URL or default path)
function getUserProfilePicture() {
    const key = getUserProfilePictureKey();
    const savedPicture = localStorage.getItem(key);
    return savedPicture || './Assets/prof-generic.png';
}

// Saves user's profile picture
function saveUserProfilePicture(dataUrl) {
    const key = getUserProfilePictureKey();
    localStorage.setItem(key, dataUrl);
}

// Gets auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('noto_token');
}

// Checks authentication and redirects if not logged in
function checkAuth() {
    const token = getAuthToken();
    const user = localStorage.getItem('noto_user');
    
    if (!token || !user) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Handles banned user responses
function handleAuthError(error) {
    if (error.message && error.message.includes('banned')) {
        localStorage.removeItem('noto_token');
        localStorage.removeItem('noto_user');
        alert('Your account has been banned. You have been logged out.');
        window.location.href = 'login.html';
        return true;
    }
    return false;
}

// ========================================
// SONGS MANAGEMENT
// ========================================
// Loads saved songs from backend
async function loadSavedSongs() {
    const token = getAuthToken();
    if (!token) {
        return;
    }

    const statusEl = document.getElementById('status');
    const errorEl = document.getElementById('error');
    const songsGrid = document.getElementById('songs-grid');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');

    if (statusEl) statusEl.style.display = 'flex';
    if (errorEl) errorEl.style.display = 'none';
    if (songsGrid) songsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (loadingState) loadingState.style.display = 'block';

    try {
        const res = await fetch(window.getApiUrl('songs/saved'), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            if (handleAuthError(new Error(errorData.error || 'Failed to load saved songs'))) {
                return;
            }
            throw new Error('Failed to load saved songs');
        }

        const songs = await res.json();
        savedSongs = songs;

        if (statusEl) statusEl.style.display = 'none';

        if (songs.length === 0) {
            if (songsGrid) songsGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        } else {
            if (songsGrid) {
                songsGrid.style.display = 'grid';
                renderSongs(songs);
            }
            if (emptyState) emptyState.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading saved songs:', error);
        if (statusEl) statusEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'Failed to load saved songs. Please try again.';
        }
    }
}

// Renders saved songs
function renderSongs(songs) {
    const songsGrid = document.getElementById('songs-grid');
    songsGrid.innerHTML = '';

    songs.forEach(song => {
        const card = document.createElement('div');
        card.style.background = 'rgba(255,255,255,0.06)';
        card.style.border = '1px solid rgba(255,255,255,0.15)';
        card.style.borderRadius = '12px';
        card.style.padding = '12px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';
        card.setAttribute('data-track-id', song.trackId);

        const img = document.createElement('img');
        img.src = song.albumImage || '';
        img.alt = song.title || 'Track cover';
        img.style.width = '100%';
        img.style.borderRadius = '8px';
        img.style.aspectRatio = '1';
        img.style.objectFit = 'cover';

        const infoContainer = document.createElement('div');
        infoContainer.style.display = 'flex';
        infoContainer.style.justifyContent = 'space-between';
        infoContainer.style.alignItems = 'flex-start';
        infoContainer.style.gap = '8px';

        const textContainer = document.createElement('div');
        textContainer.style.flex = '1';
        textContainer.style.minWidth = '0';

        const title = document.createElement('div');
        title.textContent = song.title || 'Unknown Title';
        title.style.color = 'white';
        title.style.fontWeight = '600';
        title.style.fontSize = '14px';
        title.style.marginBottom = '4px';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';
        title.style.whiteSpace = 'nowrap';

        const artist = document.createElement('div');
        artist.textContent = song.artist || 'Unknown Artist';
        artist.style.color = '#ccc';
        artist.style.fontSize = '12px';
        artist.style.overflow = 'hidden';
        artist.style.textOverflow = 'ellipsis';
        artist.style.whiteSpace = 'nowrap';

        textContainer.appendChild(title);
        textContainer.appendChild(artist);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'save-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.style.fontSize = '20px';
        deleteBtn.style.lineHeight = '1';
        deleteBtn.setAttribute('data-track-id', song.trackId);
        deleteBtn.setAttribute('title', 'Delete song');
        deleteBtn.addEventListener('click', () => deleteSong(song.trackId));

        infoContainer.appendChild(textContainer);
        infoContainer.appendChild(deleteBtn);

        card.appendChild(img);
        card.appendChild(infoContainer);

        songsGrid.appendChild(card);
    });
}

// Deletes a saved song
async function deleteSong(trackId) {
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (!confirm('Are you sure you want to remove this song from your saved songs?')) {
        return;
    }

    try {
        const res = await fetch(window.getApiUrl(`songs/${trackId}`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error('Failed to delete song');
        }

        // Removes from local array
        savedSongs = savedSongs.filter(song => song.trackId !== trackId);
        
        // Reloads the songs
        await loadSavedSongs();
        
        showNotification('Song removed successfully', 'success');
    } catch (error) {
        console.error('Error deleting song:', error);
        showNotification('Failed to delete song', 'error');
    }
}

// Shows notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Glass/bubble theme styling
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    // Color tints with transparency for glass effect
    const colors = {
        success: 'rgba(76, 175, 80, 0.8)',    // Green with transparency
        error: 'rgba(244, 67, 54, 0.8)',     // Red with transparency  
        warning: 'rgba(255, 193, 7, 0.8)',    // Yellow with transparency
        info: 'rgba(147, 112, 219, 0.8)'     // Purple with transparency
    };
    
    // Border colors matching the tints
    const borderColors = {
        success: 'rgba(76, 175, 80, 0.4)',
        error: 'rgba(244, 67, 54, 0.4)',
        warning: 'rgba(255, 193, 7, 0.4)',
        info: 'rgba(147, 112, 219, 0.4)'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.style.borderColor = borderColors[type] || borderColors.info;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ========================================
// DASHBOARD INTERFACE
// ========================================
// Sidebar functionality
function initSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar-item[data-view]');

    // Handles view switching
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            switchView(view);
        });
    });

    // Handles logout
    const logoutBtn = document.getElementById('profile-logout');
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('noto_user');
        localStorage.removeItem('noto_token');
        window.location.href = 'login.html';
    });
}

// Switches between views
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });

    // Remove active class and inline styles from all sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        item.style.backgroundColor = ''; // Remove any inline background color
    });

    // Shows selected view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // Sets active sidebar item
    const activeItem = document.querySelector(`.sidebar-item[data-view="${viewName}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
        // Apply theme accent color if theme is set (per-user)
        const themeStorageKey = getUserThemeStorageKey();
        const savedTheme = localStorage.getItem(themeStorageKey) || 'purple';
        const theme = themes[savedTheme];
        if (theme && theme.accent) {
            activeItem.style.backgroundColor = theme.accent;
        }
    }

    // Loads data for specific views
    if (viewName === 'liked') {
        loadSavedSongs();
    } else if (viewName === 'profile') {
        initProfile();
    }
}

// Handles search form
function initSearchForm() {
    const searchForm = document.getElementById('dashboard-search-form');
    const searchInput = document.getElementById('dashboard-search-input');

    searchForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchInput?.value?.trim();
        if (query) {
            window.location.href = `results.html?q=${encodeURIComponent(query)}`;
        }
    });

    // Handles search suggestion bubbles
    const suggestionBubbles = document.querySelectorAll('.search-suggestion-bubble');
    suggestionBubbles.forEach(bubble => {
        bubble.addEventListener('click', () => {
            const text = bubble.textContent.trim();
            if (searchInput) {
                searchInput.value = text;
                searchInput.focus();
            }
            // Animates bubble removal
            bubble.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            bubble.style.opacity = '0';
            bubble.style.transform = 'scale(0.8)';
            setTimeout(() => {
                bubble.remove();
            }, 300);
        });
    });
}

// ========================================
// THEME SYSTEM
// ========================================
// Applies theme to dashboard (per-user)
function applyTheme(themeName) {
    console.log('Applying theme:', themeName);
    const theme = themes[themeName];
    if (!theme) {
        console.error('Theme not found:', themeName);
        return;
    }

    const dashboardMain = document.querySelector('.dashboard-main');
    const dashboardSplit = document.querySelector('.dashboard-split');
    
    if (dashboardMain && dashboardSplit) {
        // Removes any existing video background from both locations
        const existingVideoMain = dashboardMain.querySelector('.theme-background-video');
        const existingVideoBody = document.body.querySelector('.theme-background-video');
        const existingVideoSplit = dashboardSplit.querySelector('.theme-background-video');
        
        if (existingVideoMain) existingVideoMain.remove();
        if (existingVideoBody) existingVideoBody.remove();
        if (existingVideoSplit) existingVideoSplit.remove();
        
        if (theme.video) {
            // Applies video background (Sabrina theme only)
            // Clears any GIF backgrounds first
            dashboardMain.style.backgroundImage = '';
            dashboardMain.style.backgroundSize = '';
            dashboardMain.style.backgroundPosition = '';
            dashboardMain.style.backgroundRepeat = '';
            dashboardMain.style.background = '';
            dashboardMain.classList.add('theme-gif');
            dashboardMain.setAttribute('data-theme', themeName);
            
            // Removes any existing video background
            const existingVideoMain = dashboardMain.querySelector('.theme-background-video');
            const existingVideoBody = document.body.querySelector('.theme-background-video');
            const existingVideoSplit = dashboardSplit.querySelector('.theme-background-video');
            
            if (existingVideoMain) existingVideoMain.remove();
            if (existingVideoBody) existingVideoBody.remove();
            if (existingVideoSplit) existingVideoSplit.remove();
            
            // Creates video element
            const video = document.createElement('video');
            video.className = 'theme-background-video';
            video.src = theme.video;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('muted', '');
            video.setAttribute('loop', '');
            video.preload = 'auto';
            video.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                z-index: -1;
                pointer-events: none;
                opacity: 1;
                visibility: visible;
            `;
            
            // Inserts video into dashboard-split to cover entire main area
            dashboardSplit.style.position = 'relative';
            dashboardSplit.appendChild(video);
            
            // Video element created and appended to dashboard-split
            
            // Forces video to stay visible and playing
            const ensureVideoPlays = async () => {
                try {
                    // Loads the video first
                    await video.load();
                    // Video loaded successfully
                    
                    // Tries to play with multiple strategies
                    const playPromise = video.play();
                    
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            // Video background playing successfully
                        }).catch(err => {
                            console.warn('Initial play failed, trying alternative methods:', err);
                            
                            // Strategy 1: Set video to be visible and retry
                            video.style.visibility = 'visible';
                            video.style.opacity = '1';
                            
                            // Strategy 2: Use a short timeout and retry
                            setTimeout(() => {
                                video.play().then(() => {
                                    // Video started after timeout retry
                                }).catch(err => {
                                    console.warn('Timeout retry failed, adding user interaction fallback:', err);
                                    addUserInteractionFallback();
                                });
                            }, 100);
                        });
                    }
                } catch (err) {
                    console.error('Video loading failed:', err);
                    addUserInteractionFallback();
                }
            };
            
            const addUserInteractionFallback = () => {
                const startVideoOnInteraction = () => {
                    // User interaction detected, attempting to play video
                    
                    // Makes sure video is visible and unmuted (but still muted for autoplay)
                    video.muted = true;
                    video.style.visibility = 'visible';
                    video.style.opacity = '1';
                    
                    video.play().then(() => {
                        // Video started after user interaction
                        
                        // Sets up a visibility check to keep video playing
                        const keepPlaying = () => {
                            if (video.paused && document.visibilityState === 'visible') {
                                video.play().catch(err => {
                                    // Keep playing attempt failed:
                                });
                            }
                        };
                        
                        // Checks periodically if video is still playing
                        setInterval(keepPlaying, 2000);
                        
                    }).catch(err => {
                        console.error('Video failed to start even with user interaction:', err);
                    });
                    
                    document.removeEventListener('click', startVideoOnInteraction);
                    document.removeEventListener('touchstart', startVideoOnInteraction);
                    document.removeEventListener('keydown', startVideoOnInteraction);
                };
                
                document.addEventListener('click', startVideoOnInteraction, { once: true });
                document.addEventListener('touchstart', startVideoOnInteraction, { once: true });
                document.addEventListener('keydown', startVideoOnInteraction, { once: true });
                // Video play listeners added - click, touch, or press any key to start video
            };
            
            // Start the process
            ensureVideoPlays();
        } else if (theme.gif) {
            // Apply GIF background (HMHAS theme)
            // Remove any video backgrounds first
            const existingVideoMain = dashboardMain.querySelector('.theme-background-video');
            const existingVideoBody = document.body.querySelector('.theme-background-video');
            const existingVideoSplit = dashboardSplit.querySelector('.theme-background-video');
            
            if (existingVideoMain) existingVideoMain.remove();
            if (existingVideoBody) existingVideoBody.remove();
            if (existingVideoSplit) existingVideoSplit.remove();
            
            // Add data-theme attribute for CSS targeting
            dashboardMain.setAttribute('data-theme', themeName);
            
            dashboardMain.style.setProperty('background-image', `url(${theme.gif})`, 'important');
            dashboardMain.style.setProperty('background-size', 'cover', 'important');
            dashboardMain.style.setProperty('background-position', 'center', 'important');
            dashboardMain.style.setProperty('background-repeat', 'no-repeat', 'important');
            dashboardMain.style.setProperty('background', `url(${theme.gif}) center center / cover no-repeat`, 'important');
            dashboardMain.style.position = 'relative';
            dashboardMain.style.zIndex = '1';
            dashboardMain.classList.add('theme-gif');
            // GIF background applied successfully
        } else {
            // Apply gradient background (all other themes)
            // Remove any video backgrounds first
            const existingVideoMain = dashboardMain.querySelector('.theme-background-video');
            const existingVideoBody = document.body.querySelector('.theme-background-video');
            const existingVideoSplit = dashboardSplit.querySelector('.theme-background-video');
            
            if (existingVideoMain) existingVideoMain.remove();
            if (existingVideoBody) existingVideoBody.remove();
            if (existingVideoSplit) existingVideoSplit.remove();
            
            // Remove data-theme attribute for non-GIF themes
            dashboardMain.removeAttribute('data-theme');
            
            dashboardMain.style.backgroundImage = '';
            dashboardMain.style.backgroundSize = '';
            dashboardMain.style.backgroundPosition = '';
            dashboardMain.style.backgroundRepeat = '';
            dashboardMain.style.background = theme.gradient;
            dashboardMain.style.position = '';
            dashboardMain.style.zIndex = '';
            dashboardMain.classList.remove('theme-gif');
            dashboardSplit.style.position = '';
            // Gradient background applied successfully
        }
    }

    // Update active sidebar item color
    const activeSidebarItem = document.querySelector('.sidebar-item.active');
    if (activeSidebarItem && theme.accent) {
        activeSidebarItem.style.backgroundColor = theme.accent;
    }

    // Update theme option active state
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-theme') === themeName) {
            option.classList.add('active');
            console.log('Theme option marked as active:', themeName);
        }
    });

    // Save theme for this user
    const userThemeStorageKey = getUserThemeStorageKey();
    localStorage.setItem(userThemeStorageKey, themeName);
    console.log('Theme saved to localStorage:', userThemeStorageKey, themeName);

    // Updates input focus border color
    const style = document.createElement('style');
    style.id = 'theme-dynamic-styles';
    style.textContent = `
        .profile-form input:focus {
            border-color: ${theme.accent} !important;
        }
        .theme-option.active {
            border-color: ${theme.accent} !important;
            background: rgba(${parseInt(theme.accent.slice(1, 3), 16)}, ${parseInt(theme.accent.slice(3, 5), 16)}, ${parseInt(theme.accent.slice(5, 7), 16)}, 0.2) !important;
            box-shadow: 0 0 0 2px rgba(${parseInt(theme.accent.slice(1, 3), 16)}, ${parseInt(theme.accent.slice(3, 5), 16)}, ${parseInt(theme.accent.slice(5, 7), 16)}, 0.3) !important;
        }
    `;
    
    // Remove old dynamic styles if exists
    const oldStyle = document.getElementById('theme-dynamic-styles');
    if (oldStyle) {
        oldStyle.remove();
    }
    document.head.appendChild(style);

    // Save theme preference per user
    const themeStorageKey = getUserThemeStorageKey();
    localStorage.setItem(themeStorageKey, themeName);
}

// ========================================
// USER PROFILE
// ========================================
// Initialize profile section
function initProfile() {
    const userStr = localStorage.getItem('noto_user');
    if (!userStr) return;

    try {
        const user = JSON.parse(userStr);
        const greeting = document.getElementById('profile-greeting');
        const usernameInput = document.getElementById('profile-username');
        const emailInput = document.getElementById('profile-email');

        // Display greeting with username by default, then fall back to email/identifier
        const displayName =
            (user.username && user.username.trim()) ||
            (user.email && user.email.trim()) ||
            (user.identifier && user.identifier.trim()) ||
            'User';
        if (greeting) {
            greeting.textContent = `Hello, ${displayName}`;
        }
        
        // Populate form fields
        if (usernameInput) {
            usernameInput.value = user.username || '';
        }
        if (emailInput) {
            emailInput.value = user.email || '';
        }

        // Load profile picture
        const profilePicturePreview = document.getElementById('profile-picture-preview');
        if (profilePicturePreview) {
            const pictureUrl = getUserProfilePicture();
            profilePicturePreview.src = pictureUrl;
        }

        // Initialize file upload functionality
        const uploadInput = document.getElementById('profile-picture-upload');
        const preview = document.getElementById('profile-picture-preview');
        const editIcon = document.querySelector('.profile-picture-edit-icon');

        if (!uploadInput || !preview) return;

        // Handle file selection for upload
        function handleFileSelect(file) {
            if (!file || !file.type.startsWith('image/')) {
                showNotification('Please select a valid image file', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                preview.src = dataUrl;
                saveUserProfilePicture(dataUrl);
                showNotification('Profile picture updated successfully', 'success');
            };
            reader.onerror = () => {
                showNotification('Failed to read image file', 'error');
            };
            reader.readAsDataURL(file);
        }

        // Edit icon - open file picker (only way to upload)
        if (editIcon) {
            editIcon.addEventListener('click', () => {
                uploadInput.click();
            });
        }

        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileSelect(file);
            }
            // Reset input so same file can be selected again
            uploadInput.value = '';
        });
    } catch (error) {
        console.error('Error parsing user data:', error);
    }
}

// Update greeting only (used after username changes)
function updateGreeting() {
    const userStr = localStorage.getItem('noto_user');
    if (!userStr) return;

    try {
        const user = JSON.parse(userStr);
        const greeting = document.getElementById('profile-greeting');

        // Display greeting with username by default, then fall back to email/identifier
        const displayName =
            (user.username && user.username.trim()) ||
            (user.email && user.email.trim()) ||
            (user.identifier && user.identifier.trim()) ||
            'User';
        if (greeting) {
            greeting.textContent = `Hello, ${displayName}`;
        }
    } catch (err) {
        console.error('Failed to update greeting:', err);
    }
}

// Initialize profile form handlers
function initProfileForm() {
    const updateUsernameBtn = document.getElementById('update-username-btn');
    const updateEmailBtn = document.getElementById('update-email-btn');
    const updatePasswordBtn = document.getElementById('update-password-btn');
    const usernameInput = document.getElementById('profile-username');
    const emailInput = document.getElementById('profile-email');
    const passwordInput = document.getElementById('profile-password');

    updateUsernameBtn?.addEventListener('click', async () => {
        // Update username button clicked
        const newUsername = usernameInput?.value?.trim();
        // New username:
        if (!newUsername) {
            showNotification('Please enter a username', 'error');
            return;
        }

        const token = getAuthToken();
        if (!token) return;

        try {
            // Sending request to update username...
            const res = await fetch(window.getApiUrl('user/username'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: newUsername })
            });

            // Get response as text first to debug
            const responseText = await res.text();
            
            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Response was:', responseText.substring(0, 200));
                
                // If backend endpoint doesn't exist, update locally and show warning
                if (responseText.includes('Cannot PUT') || res.status === 404) {
                    console.warn('Backend endpoint not found, updating locally only');
                    
                    // Update local storage
                    const userStr = localStorage.getItem('noto_user');
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        user.username = newUsername;
                        localStorage.setItem('noto_user', JSON.stringify(user));
                    }
                    // Update greeting only (not entire profile)
                    updateGreeting();

                    showNotification('Username updated locally (backend sync needed)', 'warning');
                    return;
                }
                
                throw new Error('Server returned invalid response. Check console for details.');
            }

            if (!res.ok) {
                throw new Error(data.message || `Server returned ${res.status}: ${res.statusText}`);
            }

            // Update local storage
            const userStr = localStorage.getItem('noto_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                user.username = newUsername;
                localStorage.setItem('noto_user', JSON.stringify(user));
            }
            // Update greeting only (not entire profile)
            updateGreeting();

            showNotification('Username updated successfully', 'success');
        } catch (error) {
            console.error('Error updating username:', error);
            showNotification(error.message || 'Failed to update username', 'error');
        }
    });

    updateEmailBtn?.addEventListener('click', async () => {
        // Update email button clicked
        const newEmail = emailInput?.value?.trim();
        // New email:
        if (!newEmail) {
            showNotification('Please enter an email', 'error');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            showNotification('Please enter a valid email address', 'error');
            return;
        }

        const token = getAuthToken();
        if (!token) return;

        try {
            // Sending request to update email...
            const res = await fetch(window.getApiUrl('user/email'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email: newEmail })
            });

            // Get response as text first to debug
            const responseText = await res.text();
            
            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Response was:', responseText.substring(0, 200));
                
                // If backend endpoint doesn't exist, update locally and show warning
                if (responseText.includes('Cannot PUT') || res.status === 404) {
                    console.warn('Backend endpoint not found, updating locally only');
                    
                    // Update local storage
                    const userStr = localStorage.getItem('noto_user');
                    if (userStr) {
                        const user = JSON.parse(userStr);
                        user.email = newEmail;
                        localStorage.setItem('noto_user', JSON.stringify(user));
                    }
                    // Don't update greeting - only username should change greeting

                    showNotification('Email updated locally (backend sync needed)', 'warning');
                    return;
                }
                
                throw new Error('Server returned invalid response. Check console for details.');
            }

            if (!res.ok) {
                throw new Error(data.message || `Server returned ${res.status}: ${res.statusText}`);
            }

            // Update local storage
            const userStr = localStorage.getItem('noto_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                user.email = newEmail;
                localStorage.setItem('noto_user', JSON.stringify(user));
            }
            // Don't update greeting - only username should change greeting

            showNotification('Email updated successfully', 'success');
        } catch (error) {
            console.error('Error updating email:', error);
            showNotification(error.message || 'Failed to update email', 'error');
        }
    });

    updatePasswordBtn?.addEventListener('click', async () => {
        const newPassword = passwordInput?.value?.trim();
        if (!newPassword) {
            showNotification('Please enter a new password', 'error');
            return;
        }

        // Password validation
        if (newPassword.length < 6) {
            showNotification('Password must be at least 6 characters long', 'error');
            return;
        }

        const token = getAuthToken();
        if (!token) return;

        try {
            // Sending request to update password...
            const res = await fetch(window.getApiUrl('user/password'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password: newPassword })
            });

            // Get response as text first to debug
            const responseText = await res.text();
            
            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                console.error('Response was:', responseText.substring(0, 200));
                
                // If backend endpoint doesn't exist, show warning
                if (responseText.includes('Cannot PUT') || res.status === 404) {
                    console.warn('Backend endpoint not found, password not updated');
                    
                    // Clear password field for security
                    passwordInput.value = '';

                    showNotification('Password update failed - backend not implemented', 'warning');
                    return;
                }
                
                throw new Error('Server returned invalid response. Check console for details.');
            }

            if (!res.ok) {
                throw new Error(data.message || `Server returned ${res.status}: ${res.statusText}`);
            }

            // Clear password field for security
            passwordInput.value = '';

            showNotification('Password updated successfully', 'success');
        } catch (error) {
            console.error('Error updating password:', error);
            showNotification(error.message || 'Failed to update password', 'error');
        }
    });
}

// Initialize theme selector (per-user theme)
function initThemeSelector() {
    const themeOptions = document.querySelectorAll('.theme-option');
    console.log('Theme selector initialized, found options:', themeOptions.length);
    
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const themeName = option.getAttribute('data-theme');
            console.log('Theme clicked:', themeName);
            applyTheme(themeName);
            
            // Handle video preview for Sabrina theme
            if (themeName === 'sabrina') {
                const previewVideo = option.querySelector('video');
                if (previewVideo) {
                    previewVideo.play().catch(err => {
                        console.log('Preview video autoplay prevented:', err);
                    });
                }
            }
        });
        
        // Handle hover effects for video previews
        const video = option.querySelector('video');
        if (video) {
            option.addEventListener('mouseenter', () => {
                video.play().catch(err => {
                    console.log('Video hover preview failed:', err);
                });
            });
            
            option.addEventListener('mouseleave', () => {
                video.pause();
                video.currentTime = 0;
            });
        }
    });

    // Load saved theme for this user or default to purple
    const savedThemeStorageKey = getUserThemeStorageKey();
    const savedTheme = localStorage.getItem(savedThemeStorageKey) || 'purple';
    console.log('Loading saved theme:', savedTheme);
    applyTheme(savedTheme);
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Handle Google OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userParam = urlParams.get('user');
    
    if (token && userParam) {
        try {
            const user = JSON.parse(decodeURIComponent(userParam));
            localStorage.setItem('noto_token', token);
            localStorage.setItem('noto_user', JSON.stringify(user));
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            console.error('Error parsing OAuth callback:', error);
        }
    }
    
    // Check authentication
    if (!checkAuth()) {
        return;
    }

    // Initialize sidebar
    initSidebar();

    // Initialize search form
    // Initialize profile form
    initProfileForm();

    // Initialize profile functionality (includes picture upload)
    initProfile();

    // Initialize theme selector
    initThemeSelector();

    // Initialize mobile sidebar toggle
    initSidebarToggle();
    
    // Test: Add simple click test to burger icon
    const burgerTest = document.getElementById('sidebar-toggle');
    if (burgerTest) {
        console.log('Burger icon found, adding test click handler');
        burgerTest.addEventListener('click', () => {
            console.log('Burger icon clicked - test handler');
        });
    }

    // Set default view to recommendations
    switchView('recommendations');
});

// ========================================
// MOBILE FUNCTIONALITY
// ========================================
// Mobile sidebar toggle functionality
function initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarNav = document.querySelector('.sidebar-nav');
    
    console.log('Sidebar toggle init:', !!sidebarToggle, !!sidebarNav);
    
    if (!sidebarToggle || !sidebarNav) {
        console.error('Sidebar toggle elements not found!');
        return;
    }
    
    sidebarToggle.addEventListener('click', () => {
        const isActive = sidebarToggle.classList.contains('active');
        console.log('Sidebar toggle clicked, was active:', isActive);
        
        // Toggle burger icon
        sidebarToggle.classList.toggle('active');
        
        // Toggle navigation menu
        sidebarNav.classList.toggle('active');
        console.log('Classes after toggle:', sidebarToggle.className, sidebarNav.className);
        
        // Close menu when clicking outside
        if (!isActive) {
            setTimeout(() => {
                document.addEventListener('click', closeSidebarOnClickOutside);
            }, 100);
        } else {
            document.removeEventListener('click', closeSidebarOnClickOutside);
        }
    });
    
    function closeSidebarOnClickOutside(e) {
        if (!sidebarToggle.contains(e.target) && !sidebarNav.contains(e.target)) {
            sidebarToggle.classList.remove('active');
            sidebarNav.classList.remove('active');
            document.removeEventListener('click', closeSidebarOnClickOutside);
        }
    }
    
    // Handle keyboard navigation
    sidebarToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sidebarToggle.click();
        }
    });
}

