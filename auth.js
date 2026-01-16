// ========================================
// AUTHENTICATION FUNCTIONALITY
// ========================================
// Handles login and registration form interactions
document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formRegister = document.getElementById('form-register');
    const authContent = document.querySelector('.auth-content');
    
    // ========================================
     // PASSWORD VISIBILITY TOGGLES
    // ========================================
    // Initializes password visibility toggle functionality
    function initPasswordToggles() {
        const passwordToggles = document.querySelectorAll('.password-toggle');
        
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const targetId = toggle.getAttribute('data-target');
                const passwordInput = document.getElementById(targetId);
                const toggleText = toggle.querySelector('.toggle-text');
                
                if (passwordInput) {
                    if (passwordInput.type === 'password') {
                        passwordInput.type = 'text';
                        toggleText.textContent = 'Hide';
                    } else {
                        passwordInput.type = 'password';
                        toggleText.textContent = 'Show';
                    }
                }
            });
        });
    }
    
    initPasswordToggles();
    
    // ========================================
// FORM VISIBILITY MANAGEMENT
    // ========================================
    // Sets initial opacity for forms
    if (formLogin) {
        formLogin.style.opacity = '1';
    }
    if (formRegister) {
        formRegister.style.opacity = '0';
    }

    // Shows login form with fade transition
    function showLogin() {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        
        // Fade transition
        formLogin.style.opacity = '0';
        setTimeout(() => {
            formRegister.setAttribute('aria-hidden', 'true');
            formRegister.hidden = true;
            formLogin.hidden = false;
            formLogin.setAttribute('aria-hidden', 'false');
            setTimeout(() => {
                formLogin.style.opacity = '1';
            }, 10);
        }, 150);
        
        // Removes register-active class to move content back up
        if (authContent) {
            authContent.classList.remove('register-active');
        }
    }

    // Shows registration form with fade transition
    function showRegister() {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        
        // Fade transition
        formRegister.style.opacity = '0';
        setTimeout(() => {
            formLogin.setAttribute('aria-hidden', 'true');
            formLogin.hidden = true;
            formRegister.hidden = false;
            formRegister.setAttribute('aria-hidden', 'false');
            setTimeout(() => {
                formRegister.style.opacity = '1';
            }, 10);
        }, 150);
        
        // Adds register-active class to move content up
        if (authContent) {
            authContent.classList.add('register-active');
        }
    }

    // ========================================
// GOOGLE OAUTH SETUP
    // ========================================
    // Sets up Google OAuth URL dynamically
    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        // Gets the base URL and constructs the Google auth URL
        const baseUrl = window.getApiBaseUrl();
        googleLoginBtn.href = `${baseUrl}/auth/google`;
    }

    // ========================================
// TAB SWITCHING
    // ========================================
    tabLogin?.addEventListener('click', showLogin);
    tabRegister?.addEventListener('click', showRegister);

    // ========================================
// LOGIN FORM HANDLING
    // ========================================
    formLogin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier')?.value?.trim();
        const password = document.getElementById('login-password')?.value;
        if (!identifier || !password) return;

        try {
            const res = await fetch(window.getApiUrl('auth/login'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Stores token and user info
            localStorage.setItem('noto_token', data.token);
            localStorage.setItem('noto_user', JSON.stringify(data.user));
            
            // Redirects to dashboard
            window.location.href = 'dashboard.html';
        } catch (err) {
            alert(err.message || 'Login failed');
        }
    });

    // ========================================
// REGISTRATION FORM HANDLING
    // ========================================
    formRegister?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('reg-identifier')?.value?.trim();
        const password = document.getElementById('reg-password')?.value;
        const confirm = document.getElementById('reg-confirm')?.value;
        if (!identifier || !password || !confirm) return;
        if (password !== confirm) {
            alert('Passwords do not match.');
            return;
        }

        try {
            const res = await fetch(window.getApiUrl('auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });

            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Stores token and user info
            localStorage.setItem('noto_token', data.token);
            localStorage.setItem('noto_user', JSON.stringify(data.user));
            
            // Redirects to dashboard
            window.location.href = 'dashboard.html';
        } catch (err) {
            alert(err.message || 'Registration failed');
        }
    });
});



