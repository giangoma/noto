// ==================== ADMIN PANEL ====================

// Admin panel state
let isAdminAuthenticated = false;

// Initialize admin panel
function initAdminPanel() {
    const loginForm = document.getElementById('admin-login-form');
    const passwordInput = document.getElementById('admin-password');
    const errorDiv = document.getElementById('admin-error');
    const loginContainer = document.getElementById('admin-login');
    const dashboardContainer = document.getElementById('admin-dashboard');
    const refreshBtn = document.getElementById('admin-refresh');

    // Reset authentication state when switching to admin view
    if (!isAdminAuthenticated) {
        loginContainer.style.display = 'flex';
        dashboardContainer.style.display = 'none';
        errorDiv.style.display = 'none';
        passwordInput.value = '';
    }

    // Handle login form submission
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const password = passwordInput.value.trim();
        
        if (password === 'JELLYDONUTS') {
            isAdminAuthenticated = true;
            loginContainer.style.display = 'none';
            dashboardContainer.style.display = 'block';
            errorDiv.style.display = 'none';
            await loadAdminUsers();
        } else {
            errorDiv.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // Handle refresh button
    refreshBtn?.addEventListener('click', async () => {
        if (isAdminAuthenticated) {
            await loadAdminUsers();
        }
    });
}

// Handle banned user responses
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

// Load all users for admin panel
async function loadAdminUsers() {
    const token = getAuthToken();
    if (!token) return;

    try {
        console.log('Loading admin users...');
        const apiUrl = window.getApiUrl('admin/users');
        console.log('API URL:', apiUrl);
        
        const res = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', res.status);
        console.log('Response headers:', res.headers);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Error response:', errorText);
            
            // Try to parse as JSON for better error handling
            try {
                const errorData = JSON.parse(errorText);
                if (handleAuthError(new Error(errorData.error || 'Failed to load users'))) {
                    return;
                }
            } catch (parseError) {
                // If parsing fails, continue with original error
            }
            
            throw new Error('Failed to load users');
        }

        const users = await res.json();
        console.log('Users loaded:', users.length);
        displayAdminUsers(users);
    } catch (error) {
        console.error('Error loading admin users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// Display users in admin panel
function displayAdminUsers(users) {
    const usersList = document.getElementById('admin-users-list');
    
    if (!usersList) return;

    usersList.innerHTML = '';

    users.forEach(user => {
        const userCard = createUserCard(user);
        usersList.appendChild(userCard);
    });
}

// Create user card element
function createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'admin-user-card';
    card.dataset.userId = user._id || user.id;

    // Add status classes if user is suspended or banned
    if (user.suspended) {
        card.classList.add('admin-user-suspended');
    }
    if (user.banned) {
        card.classList.add('admin-user-banned');
    }

    const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
    const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never';

    card.innerHTML = `
        <div class="admin-user-header">
            <div>
                <div class="admin-user-name">
                    ${user.displayName || user.username || user.email || 'Unknown User'}
                    ${user.suspended ? '<span class="admin-status-badge admin-status-suspended">Suspended</span>' : ''}
                    ${user.banned ? '<span class="admin-status-badge admin-status-banned">Banned</span>' : ''}
                </div>
                <div class="admin-user-email">${user.email || 'No email'}</div>
                <div class="admin-user-id">ID: ${user._id || user.id}</div>
            </div>
        </div>
        <div class="admin-user-date">
            Created: ${createdAt} | Last Login: ${lastLogin}
        </div>
        <div class="admin-user-actions">
            ${!user.suspended && !user.banned ? `<button class="admin-btn-suspend" onclick="adminSuspendUser('${user._id || user.id}')">Suspend</button>` : ''}
            ${!user.banned ? `<button class="admin-btn-ban" onclick="adminBanUser('${user._id || user.id}')">Ban</button>` : ''}
            ${user.suspended ? `<button class="admin-btn-suspend" onclick="adminUnsuspendUser('${user._id || user.id}')">Unsuspend</button>` : ''}
        </div>
    `;

    return card;
}

// Suspend user
async function adminSuspendUser(userId) {
    if (!confirm('Are you sure you want to suspend this user?')) return;

    const token = getAuthToken();
    if (!token) return;

    try {
        console.log('Suspending user:', userId);
        const apiUrl = window.getApiUrl(`admin/users/${userId}/suspend`);
        console.log('Suspend API URL:', apiUrl);
        
        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Suspend response status:', res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Suspend error response:', errorText);
            throw new Error('Failed to suspend user');
        }

        showNotification('User suspended successfully', 'success');
        await loadAdminUsers();
    } catch (error) {
        console.error('Error suspending user:', error);
        showNotification('Failed to suspend user', 'error');
    }
}

// Unsuspend user
async function adminUnsuspendUser(userId) {
    if (!confirm('Are you sure you want to unsuspend this user?')) return;

    const token = getAuthToken();
    if (!token) return;

    try {
        console.log('Unsuspending user:', userId);
        const apiUrl = window.getApiUrl(`admin/users/${userId}/unsuspend`);
        console.log('Unsuspend API URL:', apiUrl);
        
        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Unsuspend response status:', res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Unsuspend error response:', errorText);
            throw new Error('Failed to unsuspend user');
        }

        showNotification('User unsuspended successfully', 'success');
        await loadAdminUsers();
    } catch (error) {
        console.error('Error unsuspending user:', error);
        showNotification('Failed to unsuspend user', 'error');
    }
}

// Ban user
async function adminBanUser(userId) {
    if (!confirm('Are you sure you want to ban this user? This action cannot be undone.')) return;

    const token = getAuthToken();
    if (!token) return;

    try {
        console.log('Banning user:', userId);
        const apiUrl = window.getApiUrl(`admin/users/${userId}/ban`);
        console.log('Ban API URL:', apiUrl);
        
        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Ban response status:', res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Ban error response:', errorText);
            throw new Error('Failed to ban user');
        }

        showNotification('User banned successfully', 'success');
        await loadAdminUsers();
    } catch (error) {
        console.error('Error banning user:', error);
        showNotification('Failed to ban user', 'error');
    }
}

// Make admin functions globally accessible
window.adminSuspendUser = adminSuspendUser;
window.adminUnsuspendUser = adminUnsuspendUser;
window.adminBanUser = adminBanUser;

// Show notification (same as dashboard.js with glass theme)
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

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Listen for admin view activation
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const adminView = document.getElementById('view-admin');
                if (adminView && adminView.classList.contains('active')) {
                    initAdminPanel();
                }
            }
        });
    });

    // Start observing all dashboard views
    document.querySelectorAll('.dashboard-view').forEach(view => {
        observer.observe(view, { attributes: true });
    });
});
