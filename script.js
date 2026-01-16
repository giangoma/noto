// ========================================
// SMOOTH SCROLLING FOR ANCHOR LINKS
// ========================================
document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ========================================
// FOOTER TABS FUNCTIONALITY
// ========================================
// Initializes footer tabs with click handling and accessibility
function initFooterTabs() {
    const tabButtons = document.querySelectorAll('.footer-tab-button');
    const tabContents = document.querySelectorAll('.footer-tab-content');
    
    if (tabButtons.length === 0) return;
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);
            
            if (!targetContent) return;
            
            // Checks if this tab is already active
            const isActive = button.classList.contains('active');
            
            // Closes all tabs
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            // Opens the clicked tab if it wasn't active
            if (!isActive) {
                button.classList.add('active');
                targetContent.classList.add('active');
                
                // Smoothly scrolls to the tab
                setTimeout(() => {
                    button.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest'
                    });
                }, 100);
            }
        });
    });
    
    // ========================================
    // KEYBOARD NAVIGATION FOR TABS
    // ========================================
    // Adds keyboard navigation support for tab buttons
    tabButtons.forEach((button, index) => {
        button.addEventListener('keydown', (e) => {
            let targetIndex = index;
            
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    targetIndex = (index + 1) % tabButtons.length;
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    targetIndex = (index - 1 + tabButtons.length) % tabButtons.length;
                    break;
                case 'Home':
                    e.preventDefault();
                    targetIndex = 0;
                    break;
                case 'End':
                    e.preventDefault();
                    targetIndex = tabButtons.length - 1;
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    button.click();
                    return;
            }
            
            if (targetIndex !== index) {
                tabButtons[targetIndex].focus();
            }
        });
    });
    
    // ========================================
    // ACCESSIBILITY ATTRIBUTES
    // ========================================
    // Adds ARIA attributes for screen reader compatibility
    tabButtons.forEach((button, index) => {
        const tabId = button.getAttribute('data-tab');
        const targetContent = document.getElementById(tabId);
        
        if (targetContent) {
            button.setAttribute('aria-expanded', button.classList.contains('active'));
            button.setAttribute('aria-controls', tabId);
            targetContent.setAttribute('aria-labelledby', `${tabId}-button`);
            button.id = `${tabId}-button`;
        }
    });
    
    // ========================================
    // ARIA STATE MONITORING
    // ========================================
    // Updates ARIA expanded state when tabs change
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('footer-tab-button')) {
                    const isExpanded = target.classList.contains('active');
                    target.setAttribute('aria-expanded', isExpanded);
                }
            }
        });
    });
    
    tabButtons.forEach(button => {
        observer.observe(button, { attributes: true });
    });
}

// ========================================
// PAGE INITIALIZATION
// ========================================
// Handles page load events and initializes components
document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // LOADING OVERLAY MANAGEMENT
    // ========================================
    const overlay = document.getElementById('loading-overlay');
    const overlayImg = overlay ? overlay.querySelector('img') : null;
    const MIN_GIF_MS = 1500; // Approximate single play duration of noto-gif.gif
    if (overlay) {
        // Shows overlay immediately on first paint
        overlay.classList.add('show');
        // Restarts GIF so it plays from the beginning
        if (overlayImg) {
            const src = overlayImg.getAttribute('src');
            overlayImg.setAttribute('src', '');
            // Forces reflow
            void overlayImg.offsetWidth;
            overlayImg.setAttribute('src', src);
        }

        // Fades overlay away after page is interactive
        // Waits a tick to ensure CSS transition applies
        requestAnimationFrame(() => {
            setTimeout(() => {
                overlay.classList.add('fade-out');
                // Removes after transition ends
                setTimeout(() => {
                    overlay.classList.remove('show', 'fade-out');
                    overlay.style.display = 'none';
                }, 500);
            }, MIN_GIF_MS); // Ensures at least one full gif play
        });
    }

    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const navAuth = document.getElementById('nav-auth');

    // ========================================
    // NAVIGATION AUTHENTICATION
    // ========================================
    // Sets up navigation authentication button behavior
    if (navAuth) {
        const savedUser = localStorage.getItem('noto_user');
        const token = localStorage.getItem('noto_token');
        if (savedUser && token) {
            // Hides "Log Out" button (nav-auth)
            navAuth.style.display = 'none';
            
            // ========================================
            // PROFILE PICTURE UTILITIES
            // ========================================
            // Gets user profile picture storage key
            function getUserProfilePictureKey() {
                try {
                    const user = JSON.parse(savedUser);
                    const identifier = user.id || user._id || user.email || user.username || user.identifier;
                    return identifier ? `noto_profile_picture_${identifier}` : 'noto_profile_picture_guest';
                } catch {
                    return 'noto_profile_picture_guest';
                }
            }
            
            // Gets user profile picture URL
            function getUserProfilePicture() {
                const key = getUserProfilePictureKey();
                const savedPicture = localStorage.getItem(key);
                return savedPicture || './Assets/prof-generic.png';
            }
            
            // ========================================
            // PROFILE DROPDOWN CREATION
            // ========================================
            // Creates profile picture dropdown container
            const profileDropdownContainer = document.createElement('div');
            profileDropdownContainer.className = 'profile-dropdown-container';
            profileDropdownContainer.style.cssText = 'position: relative; display: inline-block;';
            
            // Adds profile picture button
            const profilePictureButton = document.createElement('button');
            profilePictureButton.className = 'profile-picture-nav';
            profilePictureButton.style.cssText = 'display: inline-block; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.3); cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; background: none; padding: 0;';
            
            const profileImg = document.createElement('img');
            profileImg.src = getUserProfilePicture();
            profileImg.alt = 'Profile';
            profileImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover; display: block;';
            
            profilePictureButton.appendChild(profileImg);
            
            // Creates dropdown menu
            const dropdownMenu = document.createElement('div');
            dropdownMenu.className = 'profile-dropdown-menu';
            dropdownMenu.style.cssText = 'position: absolute; top: calc(100% + 8px); right: 0; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 20px; min-width: 180px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); z-index: 1000; overflow: hidden; padding: 8px; opacity: 0; visibility: hidden; transform: translateY(-10px) scale(0.95); transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease;';
            
            // ========================================
            // DROPDOWN MENU ITEMS
            // ========================================
            // Creates Dashboard option
            const dashboardOption = document.createElement('a');
            dashboardOption.href = 'dashboard.html';
            dashboardOption.className = 'profile-dropdown-item';
            dashboardOption.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; color: white; text-decoration: none; font-size: 14px; font-weight: 500; transition: background-color 0.2s ease; border-radius: 12px;';
            
            const dashboardText = document.createElement('span');
            dashboardText.textContent = 'Dashboard';
            
            const dashboardIcon = document.createElement('img');
            dashboardIcon.src = './Assets/dashboard.png';
            dashboardIcon.alt = 'Dashboard';
            dashboardIcon.style.cssText = 'width: 20px; height: 20px; object-fit: contain; filter: brightness(0) invert(1);';
            
            dashboardOption.appendChild(dashboardText);
            dashboardOption.appendChild(dashboardIcon);
            
            // Adds hover effect to Dashboard option
            dashboardOption.addEventListener('mouseenter', () => {
                dashboardOption.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            });
            dashboardOption.addEventListener('mouseleave', () => {
                dashboardOption.style.backgroundColor = 'transparent';
            });
            
            // Creates Log Out option
            const logoutOption = document.createElement('button');
            logoutOption.className = 'profile-dropdown-item';
            logoutOption.style.cssText = 'display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 16px; color: white; text-decoration: none; font-size: 14px; font-weight: 500; transition: background-color 0.2s ease; background: none; border: none; text-align: left; cursor: pointer; border-radius: 12px;';
            
            const logoutText = document.createElement('span');
            logoutText.textContent = 'Log Out';
            
            const logoutIcon = document.createElement('img');
            logoutIcon.src = './Assets/log-out.png';
            logoutIcon.alt = 'Log Out';
            logoutIcon.style.cssText = 'width: 20px; height: 20px; object-fit: contain; filter: brightness(0) invert(1);';
            
            logoutOption.appendChild(logoutText);
            logoutOption.appendChild(logoutIcon);
            
            // Adds hover effect to Log Out option
            logoutOption.addEventListener('mouseenter', () => {
                logoutOption.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            });
            logoutOption.addEventListener('mouseleave', () => {
                logoutOption.style.backgroundColor = 'transparent';
            });
            
            // Handles logout functionality
            logoutOption.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('noto_user');
                localStorage.removeItem('noto_token');
                window.location.href = 'login.html';
            });
            
            dropdownMenu.appendChild(dashboardOption);
            dropdownMenu.appendChild(logoutOption);
            
            profileDropdownContainer.appendChild(profilePictureButton);
            profileDropdownContainer.appendChild(dropdownMenu);
            
            // ========================================
            // DROPDOWN TOGGLE FUNCTIONALITY
            // ========================================
            // Toggles dropdown on profile picture click
            let isDropdownOpen = false;
            profilePictureButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isDropdownOpen = !isDropdownOpen;
                
                if (isDropdownOpen) {
                    dropdownMenu.style.display = 'block';
                    // Forces reflow to ensure transition works
                    void dropdownMenu.offsetWidth;
                    dropdownMenu.style.opacity = '1';
                    dropdownMenu.style.visibility = 'visible';
                    dropdownMenu.style.transform = 'translateY(0) scale(1)';
                } else {
                    dropdownMenu.style.opacity = '0';
                    dropdownMenu.style.visibility = 'hidden';
                    dropdownMenu.style.transform = 'translateY(-10px) scale(0.95)';
                    // Hides after animation completes
                    setTimeout(() => {
                        if (!isDropdownOpen) {
                            dropdownMenu.style.display = 'none';
                        }
                    }, 300);
                }
            });
            
            // ========================================
            // CLICK OUTSIDE TO CLOSE
            // ========================================
            // Closes dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!profileDropdownContainer.contains(e.target)) {
                    if (isDropdownOpen) {
                        isDropdownOpen = false;
                        dropdownMenu.style.opacity = '0';
                        dropdownMenu.style.visibility = 'hidden';
                        dropdownMenu.style.transform = 'translateY(-10px) scale(0.95)';
                        // Hides after animation completes
                        setTimeout(() => {
                            dropdownMenu.style.display = 'none';
                        }, 300);
                    }
                }
            });
            
            // ========================================
            // PROFILE PICTURE HOVER EFFECTS
            // ========================================
            // Adds hover effect to profile picture
            profilePictureButton.addEventListener('mouseenter', () => {
                profilePictureButton.style.transform = 'scale(1.1)';
                profilePictureButton.style.boxShadow = '0 0 15px rgba(147, 112, 219, 0.6)';
            });
            profilePictureButton.addEventListener('mouseleave', () => {
                profilePictureButton.style.transform = 'scale(1)';
                profilePictureButton.style.boxShadow = 'none';
            });
            
            navAuth.parentNode.insertBefore(profileDropdownContainer, navAuth);
        } else {
            navAuth.textContent = 'Log In';
            navAuth.setAttribute('href', 'login.html');
        }
    }

    // ========================================
    // SEARCH FORM FUNCTIONALITY
    // ========================================
    if (!form || !input) return;
    form.addEventListener('submit', (e) => {
        // Lets the form perform a standard GET navigation to results.html?q=...
        // Ensures query is trimmed and non-empty
        if (!input.value || !input.value.trim()) {
            e.preventDefault();
            input.focus();
        } else {
            input.value = input.value.trim();
            // Shows overlay while navigating to results page
            if (overlay) {
                overlay.style.display = 'flex';
                // Forces reflow to restart transition
                void overlay.offsetWidth;
                overlay.classList.remove('fade-out');
                overlay.classList.add('show');
                // Restarts GIF on navigation
                if (overlayImg) {
                    const src = overlayImg.getAttribute('src');
                    overlayImg.setAttribute('src', '');
                    void overlayImg.offsetWidth;
                    overlayImg.setAttribute('src', src);
                }
            }
        }
    });

    // ========================================
    // GSAP ANIMATIONS
    // ========================================
    // GSAP Scroll Animation for video
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
        
        // Optimizes ScrollTrigger performance
        ScrollTrigger.config({
            autoRefreshEvents: "visibilitychange,DOMContentLoaded,load"
        });
        
        const scrollableVideo = document.getElementById('scrollable-video');
        const scrollableContainer = document.getElementById('scrollable-video-container');
        
        if (scrollableVideo && scrollableContainer) {
            // Sets initial scale to be larger
            gsap.set('#scrollable-video', { scale: 1.3, willChange: 'transform' });
            gsap.set('#scrollable-video-container', { scale: 1.3, willChange: 'transform' });
            
            const videoTL = gsap.timeline({
                scrollTrigger: {
                    trigger: scrollableContainer,
                    start: 'top top',
                    end: '+=100%',
                    scrub: true, // Smooth scrubbing
                    pin: false,
                    anticipatePin: 1,
                    refreshPriority: -1
                }
            });

            // Animates both video and container to scale 1.0 (current size)
            videoTL.to(['#scrollable-video', '#scrollable-video-container'], {
                scale: 1.0,
                ease: 'power1.out', // Smoother easing
                force3D: true // Enables hardware acceleration
            });
        }

        // ========================================
        // FEATURES SECTION ANIMATIONS
        // ========================================
        // GSAP Animations for Features Section
        const features = document.querySelectorAll('.feature');
        
        if (features.length > 0) {
            // Animates each feature with staggered timing
            features.forEach((feature, index) => {
                const isReverse = feature.classList.contains('reverse');
                const featureText = feature.querySelector('.feature-text');
                const placeholder = feature.querySelector('.placeholder');
                
                // Sets initial states
                gsap.set(featureText, {
                    opacity: 0,
                    y: isReverse ? -50 : 50,
                    x: isReverse ? 50 : -50
                });
                
                gsap.set(placeholder, {
                    opacity: 0,
                    scale: 0.8,
                    rotation: isReverse ? -15 : 15
                });
                
                // Creates timeline for this feature
                const featureTL = gsap.timeline({
                    scrollTrigger: {
                        trigger: feature,
                        start: 'top 80%',
                        end: 'bottom 20%',
                        toggleActions: 'play none none reverse',
                        scrub: 0.5
                    }
                });
                
                // Animates text content
                featureTL.to(featureText, {
                    opacity: 1,
                    y: 0,
                    x: 0,
                    duration: 0.8,
                    ease: 'power2.out'
                })
                .to(placeholder, {
                    opacity: 1,
                    scale: 1,
                    rotation: 0,
                    duration: 0.6,
                    ease: 'back.out(1.7)'
                }, '-=0.4'); // Starts placeholder animation slightly before text animation completes
            });
            
            // ========================================
            // FEATURES HOVER EFFECTS
            // ========================================
            // Adds hover effects for interactive experience
            features.forEach(feature => {
                const placeholder = feature.querySelector('.placeholder');
                
                feature.addEventListener('mouseenter', () => {
                    gsap.to(placeholder, {
                        scale: 1.05,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                });
                
                feature.addEventListener('mouseleave', () => {
                    gsap.to(placeholder, {
                        scale: 1,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                });
            });
        }
    }

    // ========================================
    // FINAL INITIALIZATION
    // ========================================
    // Initializes Footer Tabs
    initFooterTabs();
});
