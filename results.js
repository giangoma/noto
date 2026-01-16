// ========================================
// API CONFIGURATION
// ========================================
// Gets API keys from server-side configuration (injected by server)
const CONFIG = {
    geminiApiKey: window.APP_CONFIG?.GEMINI_API_KEY,
    spotifyClientId: window.APP_CONFIG?.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: window.APP_CONFIG?.SPOTIFY_CLIENT_SECRET,
    lastfmApiKey: window.APP_CONFIG?.LASTFM_API_KEY,
};

// Validates required environment variables
function validateConfig() {
    const missing = [];
    
    if (!CONFIG.geminiApiKey) missing.push('GEMINI_API_KEY');
    if (!CONFIG.spotifyClientId) missing.push('SPOTIFY_CLIENT_ID');
    if (!CONFIG.spotifyClientSecret) missing.push('SPOTIFY_CLIENT_SECRET');
    if (!CONFIG.lastfmApiKey) missing.push('LASTFM_API_KEY');
    
    if (missing.length > 0) {
        console.error('Missing required environment variables:', missing.join(', '));
        console.error('Please set these environment variables and restart the application.');
        return false;
    }
    
    return true;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
// Gets query parameter from URL
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
}

// Lists available Gemini models for debugging
async function listAvailableModels(apiKey) {
    try {
        const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey));
        if (resp.ok) {
            const data = await resp.json();
            const geminiModels = data.models?.filter(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'));
            console.log('Available Gemini models:', geminiModels?.map(m => m.name));
            console.log('Full model details:', geminiModels);
            return geminiModels;
        } else {
            console.error('Failed to list models:', resp.status, await resp.text());
        }
    } catch (err) {
        console.log('Could not list models:', err);
    }
}

// Makes model checking available globally for debugging
window.checkGeminiModels = () => listAvailableModels(CONFIG.geminiApiKey);

// Tests Gemini search terms generation
window.testGeminiTerms = async (prompt) => {
    try {
        const terms = await findSimilarSongs(prompt);
        console.log('Generated search terms for "' + prompt + '":', terms);
        return terms;
    } catch (err) {
        console.error('Error generating terms:', err);
    }
};

// ========================================
// LAST.FM API FUNCTIONS
// ========================================
// Fetches Last.fm artist data with backend fallback
async function fetchLastfmArtistData(artistName) {
    try {
        console.log('Fetching Last.fm data for artist:', artistName);
        
        // Tries the local backend first
        try {
            const response = await fetch(`http://localhost:3001/api/lastfm/artist/${encodeURIComponent(artistName)}`);
            if (response.ok) {
                const data = await response.json();
                console.log('Last.fm data retrieved via backend:', data);
                return data;
            }
        } catch (err) {
            console.log('Backend not available for Last.fm, trying direct API...');
        }

        // Falls back to direct Last.fm API calls
        const [artistInfo, topTags] = await Promise.all([
            fetchLastfmArtistInfo(artistName),
            fetchLastfmTopTags(artistName)
        ]);

        return { artistInfo, topTags };
        
    } catch (err) {
        console.error('Error fetching Last.fm data:', err);
        return { artistInfo: null, topTags: [] };
    }
}

// Fetches Last.fm artist info directly
async function fetchLastfmArtistInfo(artistName) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${CONFIG.lastfmApiKey}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Last.fm artist info failed: ' + response.status);
    }
    
    const data = await response.json();
    return data.artist || null;
}

// Fetches Last.fm top tags directly
async function fetchLastfmTopTags(artistName) {
    const url = `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}&api_key=${CONFIG.lastfmApiKey}&format=json`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Last.fm top tags failed: ' + response.status);
    }
    
    const data = await response.json();
    return data.toptags?.tag || [];
}

// ========================================
// SONG DISCOVERY FUNCTIONS
// ========================================
// Finds similar songs based on user prompt
async function findSimilarSongs(userPrompt) {
    // Extracts song and artist from the prompt
    const songMatch = userPrompt.match(/["']([^"']+)["']\s+by\s+([^,]+)/i);
    if (!songMatch) {
        // Falls back to old method for non-specific requests
        return await callGeminiTransformToSearchTerms(userPrompt);
    }

    const songTitle = songMatch[1].trim();
    const artistName = songMatch[2].trim();

    console.log(`Looking for song: "${songTitle}" by ${artistName}`);

    try {
        // First, searches for the specific song on Spotify
        const searchUrl = `https://api.spotify.com/v1/search?q=track:"${encodeURIComponent(songTitle)}" artist:"${encodeURIComponent(artistName)}"&type=track&limit=5&market=PH`;

        let trackData = null;

        // Tries local backend first
        try {
            const response = await fetch(`http://localhost:3001/api/spotify/search?q=${encodeURIComponent(`track:"${songTitle}" artist:"${artistName}"`)}`);
            if (response.ok) {
                const data = await response.json();
                trackData = data.tracks?.items?.[0];
            }
        } catch (err) {
            console.log('Backend not available, trying direct search...');
        }

        if (!trackData) {
            // Falls back to CORS proxy
            const token = await getSpotifyToken();
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(searchUrl);
            const response = await fetch(proxyUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                trackData = data.tracks?.items?.[0];
            }
        }

        if (!trackData) {
            console.log('Song not found on Spotify, falling back to Gemini analysis');
            return await callGeminiTransformToSearchTerms(userPrompt);
        }

        console.log('Found track:', trackData.name, 'by', trackData.artists[0].name);

        // Gets track details including audio features
        const trackId = trackData.id;

        let audioFeatures = null;
        // Tries local backend first (reliable, no CORS issues)
        try {
            const response = await fetch(`http://localhost:3001/api/spotify/audio-features/${trackId}`);
            if (response.ok) {
                audioFeatures = await response.json();
            }
        } catch (err) {
            console.log('Backend not available for audio features, trying proxies...');
        }

        // Fallback via CORS proxy if backend unavailable
        if (!audioFeatures) {
            try {
                const token = await getSpotifyToken();
                const featuresUrl = `https://api.spotify.com/v1/audio-features/${trackId}`;
                const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(featuresUrl);
                const response = await fetch(proxyUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    audioFeatures = await response.json();
                }
            } catch (err) {
                console.log('Could not get audio features');
            }
        }

        // Fetches Last.fm data for better regional/genre context
        const lastfmData = await fetchLastfmArtistData(trackData.artists[0].name);

        // Uses Gemini to analyze the song and find similar ones with Last.fm context
        return await analyzeSongAndFindSimilar(trackData, audioFeatures, userPrompt, lastfmData);

    } catch (err) {
        console.error('Error finding similar songs:', err);
        return await callGeminiTransformToSearchTerms(userPrompt);
    }
}

// Analyzes song and finds similar ones using Gemini AI
async function analyzeSongAndFindSimilar(trackData, audioFeatures, originalPrompt, lastfmData) {
    // This prompt generates specific, multi-part search terms
    const systemInstruction = `You are an expert music analyst for a recommendation system. Given a song or artist's details and audio features, generate 4-6 highly specific and varied search queries for the Spotify API to find *musically* similar songs.

SONG DETAILS:
- Title: ${trackData.name}
- Artist: ${trackData.artists.map(a => a.name).join(', ')}
- Album: ${trackData.album.name}
- Genres: ${trackData.album.genres?.join(', ') || 'Unknown'}

AUDIO FEATURES:
- Energy: ${audioFeatures?.energy}/1.0
- Valence (mood): ${audioFeatures?.valence}/1.0 (0=sad, 1=happy)
- Tempo: ${audioFeatures?.tempo} BPM

RULES for Generating Queries:
1.  **STRICT Exclusion (Priority 1):** Do NOT include the original song's title, the original artist's name, or the album title in any search query.
2.  **Linguistic/Regional Focus:** If the song is identified as OPM (or any specific regional music), ensure **at least two queries** use a regional tag (e.g., 'genre:"OPM"', 'Tagalog') combined with audio features.
3.  **Last.fm Tag Integration (CRITICAL):** You have access to specific, detailed tags from Last.fm (e.g., "Pinoy rock," "melancholic," "driving guitars"). **At least two queries MUST use these specific, detailed tags** as part of the search string to target niche communities.
4.  **Similar Artist Query:** Suggest 2-3 **genre-appropriate similar artists** and query by their names, focusing on regional peers (e.g., 'artist:Urbandub OR artist:Eraserheads').
5.  **Objective Feature Query (New):** Generate one query that relies **ONLY on objective numbers** (Tempo and Year Range) combined with a translated feature (Energy or Valence) to capture structure, not just genre (e.g., 'energy:0.7-0.9 tempo:140-160 year:2018-2024').
6.  **Avoid Generic Tags:** Only use broad genres like "pop," "rock," or "indie" if you combine them with highly specific mood or feature adjectives (e.g., instead of "indie," use "mellow acoustic indie pop").
7.  **Avoid Literal Keywords:** Do not directly use non-musical keywords from the user's prompt. Avoid taking the user's prompt literally. (e.g. if the user searches 'house music', suggest house beats instead of songs with 'house' in the name.) Focus solely on the extracted song details and audio/regional features.

Respond ONLY as a JSON array of strings. Each string must be a ready-to-use search query for the Spotify API.`;

    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: systemInstruction + "\n\nOriginal request: " + originalPrompt }
                ]
            }
        ]
    };

    const apiKey = CONFIG.geminiApiKey;
    if (!apiKey) throw new Error('Missing Gemini API key');

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + encodeURIComponent(apiKey);

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text();
        console.error('Gemini API error:', text);
        throw new Error('Gemini error: ' + resp.status + ' ' + text);
    }

    const data = await resp.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? '';

    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length) {
            console.log('Generated similar song search terms:', parsed);
            return parsed.slice(0, 6);
        }
    } catch { }

    // Fallback: use artist and genre info
    const fallbackTerms = [
        `genre:"${trackData.album.genres?.[0] || 'indie'}"`, // Use genre filter
        `artist:"similar to ${trackData.artists[0].name}"`,
        `vibe of ${trackData.name}`
    ];
    return fallbackTerms;
}

// ========================================
// GEMINI AI FUNCTIONS
// ========================================
// Transforms user prompt to search terms using Gemini
async function callGeminiTransformToSearchTerms(userPrompt) {
    // Fallback method for non-specific requests
    const systemInstruction = `You are an expert music curator. Given a user's prompt about mood, vibe, or music taste, generate 4-6 highly specific search terms that will find songs matching that exact vibe.

Rules:
- Include specific artists, genres, or subgenres that match the vibe
- Use terms like "chill", "upbeat", "melancholic", "energetic" when appropriate
- Include decade references if relevant (e.g., "90s", "2000s")
- Mix artist names with descriptive terms
- Focus on finding songs that share the SAME emotional tone and style

Respond ONLY as a JSON array of strings.`;

    const body = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: systemInstruction + "\n\nUser prompt: " + userPrompt }
                ]
            }
        ]
    };

    const apiKey = CONFIG.geminiApiKey;
    if (!apiKey) throw new Error('Missing Gemini API key');

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + encodeURIComponent(apiKey);

    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text();
        console.error('Gemini API error:', text);
        throw new Error('Gemini error: ' + resp.status + ' ' + text);
    }

    const data = await resp.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? '';

    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length) return parsed.slice(0, 6);
    } catch { }

    return [userPrompt];
}

// ========================================
// SPOTIFY API FUNCTIONS
// ========================================
// Cache for Spotify access token
let spotifyToken = null;
let tokenExpiry = 0;

// Gets Spotify access token with caching and fallbacks
async function getSpotifyToken() {
    // Returns cached token if still valid
    if (spotifyToken && Date.now() < tokenExpiry) {
        return spotifyToken;
    }

    console.log('Getting Spotify token...');

    // Tries local backend first (no CORS issues)
    try {
        const response = await fetch('http://localhost:3001/api/spotify/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
            const data = await response.json();
            spotifyToken = data.access_token;
            tokenExpiry = Date.now() + (3600 * 1000) - 60000; // 1 hour buffer
            console.log('Spotify token obtained via backend');
            return spotifyToken;
        }
    } catch (err) {
        console.log('Backend not available for token, trying CORS proxies...');
    }

    // Falls back to CORS proxies if backend unavailable
    const clientId = CONFIG.spotifyClientId;
    const clientSecret = CONFIG.spotifyClientSecret;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Spotify credentials');
    }

    const proxies = [
        'https://corsproxy.io/?',
        'https://api.codetabs.com/v1/proxy?quest=',
        'https://cors-anywhere.herokuapp.com/'
    ];

    const tokenUrl = 'https://accounts.spotify.com/api/token';

    for (const proxy of proxies) {
        try {
            const proxyUrl = proxy + encodeURIComponent(tokenUrl);
            console.log('Trying proxy:', proxy);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: clientId,
                    client_secret: clientSecret,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                spotifyToken = data.access_token;
                tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer
                console.log('Spotify token obtained via proxy');
                return spotifyToken;
            } else {
                console.log(`Token request failed with ${response.status}:`, await response.text());
            }
        } catch (err) {
            console.log(`Proxy ${proxy} failed:`, err.message);
            continue;
        }
    }

    throw new Error('All token request methods failed');
}

/**
 * Searches Spotify for a single term with diversification
 * @param {string} term - The search query (e.g., 'genre:"OPM" energy:0.8').
 * @returns {Promise<Array<Object>>} - An array of Spotify track objects.
 */
async function searchSpotify(term) {
    const TRACK_LIMIT = 5; // Uses a small limit to diversify results across multiple smart queries
    try {
        console.log('Searching Spotify for:', term);

        // Tries local backend first
        try {
            const response = await fetch(`http://localhost:3001/api/spotify/search?q=${encodeURIComponent(term)}&limit=${TRACK_LIMIT}`);
            if (response.ok) {
                const data = await response.json();
                console.log('Spotify search successful via backend, found', data.tracks?.items?.length || 0, 'tracks');
                return data.tracks?.items || [];
            }
        } catch (err) {
            console.log('Local backend not available, trying CORS proxies...');
        }

        // Falls back to CORS proxies if backend not available
        const token = await getSpotifyToken();
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=${TRACK_LIMIT}&market=PH`;

        const proxies = [
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest=',
            'https://cors-anywhere.herokuapp.com/'
        ];

        for (const proxy of proxies) {
            try {
                const proxyUrl = proxy + encodeURIComponent(searchUrl);
                console.log('Trying search proxy:', proxy);

                const response = await fetch(proxyUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Spotify search successful, found', data.tracks?.items?.length || 0, 'tracks');
                    return data.tracks?.items || [];
                } else {
                    console.log(`Search request failed with ${response.status}:`, await response.text());
                }
            } catch (err) {
                console.log(`Search proxy ${proxy} failed:`, err.message);
                continue;
            }
        }

        throw new Error('All search methods failed');

    } catch (err) {
        console.error('Spotify search failed:', err);

        // Falls back to mock data for demo
        console.warn('Using mock data for demo');
        return [
            {
                id: '1',
                name: 'Sample Track 1',
                artists: [{ name: 'Sample Artist' }],
                album: {
                    images: [{ url: 'https://via.placeholder.com/300x300/9370DB/FFFFFF?text=Track+1' }]
                },
                external_urls: { spotify: '#' }
            },
            {
                id: '2',
                name: 'Sample Track 2',
                artists: [{ name: 'Sample Artist 2' }],
                album: {
                    images: [{ url: 'https://via.placeholder.com/300x300/9370DB/FFFFFF?text=Track+2' }]
                },
                external_urls: { spotify: '#' }
            }
        ];
    }
}

// ========================================
// AUDIO PLAYBACK FUNCTIONS
// ========================================
// Toggles playback for a specific track
async function toggleTrackPlayback(track, playBtn) {
    try {
        // If this track is currently playing, pauses it
        if (currentTrack && currentTrack.id === track.id && isPlaying) {
            if (currentAudio) {
                currentAudio.pause();
            }
            return;
        }

        // Stops any currently playing audio
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        // Resets all play buttons to play state
        resetAllPlayButtons();

        // Shows loading state
        playBtn.innerHTML = '⏳';
        playBtn.style.background = '#666';
        updateTooltip(playBtn, 'Checking for preview...');

        // Tries to get preview URL from backend
        let previewUrl = null;
        try {
            const response = await fetch(`http://localhost:3001/api/spotify/track/${track.id}`);
            if (response.ok) {
                const trackData = await response.json();
                previewUrl = trackData.preview_url;
            }
        } catch (err) {
            // Backend not available, will try direct API
        }

        if (previewUrl) {
            // Plays preview using HTML5 audio
            currentAudio = new Audio(previewUrl);
            currentAudio.volume = 0.7;
            
            currentAudio.onplay = () => {
                isPlaying = true;
                currentTrack = track;
                playBtn.innerHTML = '⏸';
                playBtn.style.background = '#ff6b6b';
                updateTooltip(playBtn, 'Pause preview');
            };
            
            currentAudio.onpause = () => {
                isPlaying = false;
                playBtn.innerHTML = '▶';
                playBtn.style.background = '#1DB954';
                updateTooltip(playBtn, 'Try preview (may not be available)');
            };
            
            currentAudio.onended = () => {
                isPlaying = false;
                currentTrack = null;
                playBtn.innerHTML = '▶';
                playBtn.style.background = '#1DB954';
                updateTooltip(playBtn, 'Try preview (may not be available)');
            };
            
            currentAudio.onerror = (e) => {
                playBtn.innerHTML = '❌';
                playBtn.style.background = '#666';
                updateTooltip(playBtn, 'Preview failed');
                setTimeout(() => {
                    playBtn.innerHTML = '▶';
                    playBtn.style.background = '#1DB954';
                    updateTooltip(playBtn, 'Try preview (may not be available)');
                }, 2000);
            };

            try {
                await currentAudio.play();
            } catch (playError) {
                playBtn.innerHTML = '❌';
                playBtn.style.background = '#666';
                updateTooltip(playBtn, 'Preview failed');
                setTimeout(() => {
                    playBtn.innerHTML = '▶';
                    playBtn.style.background = '#1DB954';
                    updateTooltip(playBtn, 'Try preview (may not be available)');
                }, 2000);
            }
            
        } else {
            // No preview available from backend, tries direct Spotify API
            try {
                if (!spotifyToken) {
                    await getSpotifyToken();
                }
                
                const directResponse = await fetch(`https://api.spotify.com/v1/tracks/${track.id}`, {
                    headers: {
                        'Authorization': `Bearer ${spotifyToken}`
                    }
                });
                
                if (directResponse.ok) {
                    const directTrackData = await directResponse.json();
                    const directPreviewUrl = directTrackData.preview_url;
                    
                    if (directPreviewUrl) {
                        // Plays preview using direct URL
                        currentAudio = new Audio(directPreviewUrl);
                        currentAudio.volume = 0.7;
                        
                        currentAudio.onplay = () => {
                            isPlaying = true;
                            currentTrack = track;
                            playBtn.innerHTML = '⏸';
                            playBtn.style.background = '#ff6b6b';
                            updateTooltip(playBtn, 'Pause preview');
                        };
                        
                        currentAudio.onended = () => {
                            isPlaying = false;
                            currentTrack = null;
                            playBtn.innerHTML = '▶';
                            playBtn.style.background = '#1DB954';
                            updateTooltip(playBtn, 'Try preview (may not be available)');
                        };
                        
                        currentAudio.onerror = (e) => {
                            playBtn.innerHTML = '❌';
                            playBtn.style.background = '#666';
                            updateTooltip(playBtn, 'Preview failed');
                            setTimeout(() => {
                                playBtn.innerHTML = '▶';
                                playBtn.style.background = '#1DB954';
                                updateTooltip(playBtn, 'Try preview (may not be available)');
                            }, 2000);
                        };

                        await currentAudio.play();
                        return;
                    }
                }
            } catch (directErr) {
                // Direct API also failed
            }
            
            // No preview available anywhere, open Spotify directly
            playBtn.innerHTML = '🎵';
            playBtn.style.background = '#1DB954';
            updateTooltip(playBtn, 'Opening in Spotify...');
            
            // Open Spotify after a brief visual feedback
            setTimeout(() => {
                window.open(track.external_urls?.spotify, '_blank');
                playBtn.innerHTML = '▶';
                playBtn.style.background = '#1DB954';
                updateTooltip(playBtn, 'Try preview (may not be available)');
            }, 500);
        }
        
    } catch (err) {
        console.error('Error playing track:', err);
        playBtn.innerHTML = '❌';
        playBtn.style.background = '#666';
        setTimeout(() => {
            playBtn.innerHTML = '▶';
            playBtn.style.background = '#1DB954';
        }, 2000);
    }
}

// Resets all play buttons to play state
function resetAllPlayButtons() {
    const allPlayButtons = document.querySelectorAll('button');
    allPlayButtons.forEach(btn => {
        if (btn.innerHTML === '⏸') {
            btn.innerHTML = '▶';
            btn.style.background = '#1DB954';
            updateTooltip(btn, 'Try preview (may not be available)');
        }
    });
}

// ========================================
// UI UTILITY FUNCTIONS
// ========================================
// Sets status message
function setStatus(text) {
    const status = document.getElementById('status');
    if (!status) return;
    const span = status.querySelector('span');
    if (span) span.textContent = text;
}

// Shows error message
function fail(message) {
    const status = document.getElementById('status');
    if (status) status.style.display = 'none';
    const err = document.getElementById('error');
    if (err) {
        err.textContent = message;
        err.style.display = 'block';
    }
}

// ========================================
// MAIN APPLICATION LOGIC
// ========================================
// Main function that orchestrates the entire search process
async function main() {
    // Validates configuration before proceeding
    if (!validateConfig()) {
        fail('Application configuration is incomplete. Please check console for details.');
        return;
    }
    
    const q = getQueryParam('q').trim();
    if (!q) {
        fail('Missing search query. Go back and try again.');
        return;
    }
    setStatus('Analyzing your prompt and fetching songs…');
    const overlay = document.getElementById('loading-overlay');
    const overlayImg = overlay ? overlay.querySelector('img') : null;
    const MIN_GIF_MS = 1500; // Approximate single play duration of noto-gif.gif
    if (overlay) {
        overlay.style.display = 'flex';
        void overlay.offsetWidth;
        overlay.classList.add('show');
        overlay.classList.remove('fade-out');
        // Restarts GIF so it plays from the start
        if (overlayImg) {
            const src = overlayImg.getAttribute('src');
            overlayImg.setAttribute('src', '');
            void overlayImg.offsetWidth;
            overlayImg.setAttribute('src', src);
        }
    }

    try {
        const terms = await findSimilarSongs(q);
        setStatus('Searching Spotify with ' + terms.length + ' smart queries…');
        
        // Runs multiple searches concurrently
        const resultsBatches = await Promise.all(terms.map(t => searchSpotify(t)));
        
        const merged = [];
        const seen = new Set();

        // Prioritizes results from earlier search terms (they're usually more relevant)
        for (let i = 0; i < resultsBatches.length; i++) {
            const batch = resultsBatches[i];
            for (const track of batch) {
                const key = track?.id;
                if (key && !seen.has(key)) {
                    seen.add(key);
                    // Adds priority score based on search term order
                    track._priority = i;
                    merged.push(track);
                }
            }
        }

        // Sorts by priority (earlier terms first) and popularity
        merged.sort((a, b) => {
            if (a._priority !== b._priority) {
                return a._priority - b._priority;
            }
            // If same priority, sorts by popularity (Spotify provides this)
            return (b.popularity || 0) - (a.popularity || 0);
        });

        const status = document.getElementById('status');
        if (status) status.style.display = 'none';
        renderResults(merged.slice(0, 30)); // Shows fewer but better results
        if (overlay) {
            // Ensures at least one full gif play before hiding
            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.classList.remove('show', 'fade-out');
                    overlay.style.display = 'none';
                }, 350);
            }, MIN_GIF_MS);
        }
    } catch (err) {
        console.error(err);
        fail(err.message || 'Something went wrong');
        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.classList.remove('show', 'fade-out');
                    overlay.style.display = 'none';
                }, 350);
            }, MIN_GIF_MS);
        }
    }
}

// ========================================
// AUDIO PLAYER STATE
// ========================================
// Simple audio preview player
let currentAudio = null;
let currentTrack = null;
let isPlaying = false;

// ========================================
// TOOLTIP FUNCTIONS
// ========================================
// Updates custom tooltip text
function updateTooltip(playBtn, text) {
    const tooltip = playBtn.querySelector('.custom-tooltip');
    if (tooltip) {
        tooltip.textContent = text;
    }
}

// ========================================
// DEBUG FUNCTIONS
// ========================================
// Tests backend and preview URLs
window.testPreview = async (trackId) => {
    try {
        console.log('Testing preview for track ID:', trackId);
        const response = await fetch(`http://localhost:3001/api/spotify/track/${trackId}`);
        if (response.ok) {
            const trackData = await response.json();
            console.log('Track data:', trackData);
            console.log('Preview URL:', trackData.preview_url);
            
            if (trackData.preview_url) {
                // Tests playing the audio
                const audio = new Audio(trackData.preview_url);
                audio.onplay = () => console.log('Test audio playing');
                audio.onerror = (e) => console.error('Test audio error:', e);
                await audio.play();
            } else {
                console.log('No preview URL available for this track');
            }
        } else {
            console.error('Backend error:', response.status, await response.text());
        }
    } catch (err) {
        console.error('Test error:', err);
    }
};

// ========================================
// SAVED SONGS FEATURE
// ========================================
// User authentication state
let currentUser = null;
let savedSongs = [];

// Gets auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('noto_token');
}

// Initializes authentication and saved songs from backend
async function initializeAuth() {
    const savedUser = localStorage.getItem('noto_user');
    const token = getAuthToken();
    
    if (savedUser && token) {
        currentUser = JSON.parse(savedUser);
        // Loads saved songs from backend
        try {
            const res = await fetch('http://localhost:3001/api/songs/saved', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const songs = await res.json();
                savedSongs = songs.map(song => ({
                    id: song.trackId,
                    title: song.title,
                    artist: song.artist,
                    albumImage: song.albumImage
                }));
            }
        } catch (error) {
            console.error('Failed to load saved songs:', error);
        }
        updateAllSaveButtonStates();
    }
}

// Updates all save button states based on authentication and saved songs
async function updateAllSaveButtonStates() {
    const saveButtons = document.querySelectorAll('.save-btn');
    
    // Returns early if no save buttons found
    if (saveButtons.length === 0) {
        return;
    }
    
    const token = getAuthToken();
    
    for (const btn of saveButtons) {
        const trackId = btn.getAttribute('data-track-id');
        const tooltip = btn.querySelector('.save-tooltip');
        
        if (!currentUser || !token) {
            btn.classList.remove('saved');
            btn.innerHTML = '+';
            if (tooltip) {
                tooltip.textContent = 'Login to save';
            }
            continue;
        }
        
        // Checks if saved from local array or backend
        let isSaved = savedSongs.some(song => song.id === trackId);
        
        // If not in local array, checks backend
        if (!isSaved && token) {
            try {
                const res = await fetch(`http://localhost:3001/api/songs/check/${trackId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    isSaved = data.isSaved;
                }
            } catch (error) {
                console.error('Failed to check song status:', error);
            }
        }
        
        if (isSaved) {
            btn.classList.add('saved');
            btn.innerHTML = '✓';
            if (tooltip) {
                tooltip.textContent = 'Remove from saved';
            }
        } else {
            btn.classList.remove('saved');
            btn.innerHTML = '+';
            if (tooltip) {
                tooltip.textContent = 'Save song';
            }
        }
    }
}

// ========================================
// SONG SAVE/UNSAVE HANDLING
// ========================================
// Handles individual song save/unsave functionality
async function handleSaveSong(trackId, title, artist, albumImage) {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    const token = getAuthToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Checks if song is already saved
    const existingIndex = savedSongs.findIndex(song => song.id === trackId);
    
    if (existingIndex !== -1) {
        // Removes from saved songs
        try {
            const res = await fetch(`http://localhost:3001/api/songs/${trackId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                savedSongs.splice(existingIndex, 1);
                showNotification('Removed from saved songs', 'info');
            } else {
                throw new Error('Failed to remove song');
            }
        } catch (error) {
            console.error('Error removing song:', error);
            showNotification('Failed to remove song', 'error');
            return;
        }
    } else {
        // Adds to saved songs
        try {
            const res = await fetch('http://localhost:3001/api/songs/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    trackId,
                    title,
                    artist,
                    albumImage
                })
            });
            
            if (res.ok) {
                const songToSave = {
                    id: trackId,
                    title: title,
                    artist: artist,
                    albumImage: albumImage
                };
                savedSongs.push(songToSave);
                showNotification('Song saved!', 'success');
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save song');
            }
        } catch (error) {
            console.error('Error saving song:', error);
            showNotification(error.message || 'Failed to save song', 'error');
            return;
        }
    }
    
    // Updates all save button states
    await updateAllSaveButtonStates();
}

// ========================================
// NOTIFICATION SYSTEM
// ========================================
// Shows notification message
function showNotification(message, type = 'info') {
    // Creates notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Styles the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '600',
        fontSize: '14px',
        zIndex: '10001',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });
    
    // Sets background color based on type
    const colors = {
        success: '#1DB954',
        error: '#ff6b6b',
        info: '#9370DB'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Adds to page
    document.body.appendChild(notification);
    
    // Animates in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Removes after 3 seconds
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
// AUTHENTICATION FUNCTIONS
// ========================================
// Logs out user and clears session
function logout() {
    currentUser = null;
    localStorage.removeItem('noto_user');
    localStorage.removeItem('noto_token');
    savedSongs = [];
    updateAllSaveButtonStates();
    window.location.href = 'login.html';
}

// ========================================
// EVENT LISTENERS
// ========================================
// Initializes authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initializes authentication
    await initializeAuth();
});

// ========================================
// RESULTS RENDERING
// ========================================
// Renders search results with save functionality
function renderResults(results) {
    const container = document.getElementById('results');
    container.innerHTML = '';
    container.style.display = 'block';

    if (!results.length) {
        container.innerHTML = '<p style="color:white">No results found.</p>';
        return;
    }

    const list = document.createElement('div');
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    list.style.gap = '16px';

    for (const track of results) {
        const card = document.createElement('div');
        card.setAttribute('data-track-id', track.id);
        card.style.background = 'rgba(255,255,255,0.06)';
        card.style.border = '1px solid rgba(255,255,255,0.15)';
        card.style.borderRadius = '12px';
        card.style.padding = '12px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';

        const img = document.createElement('img');
        img.src = track.album?.images?.[0]?.url || '';
        img.alt = track.name || 'Track cover';
        img.style.width = '100%';
        img.style.borderRadius = '8px';

        // Track info container with buttons
        const trackInfo = document.createElement('div');
        trackInfo.style.display = 'flex';
        trackInfo.style.alignItems = 'center';
        trackInfo.style.gap = '8px';

        const trackDetails = document.createElement('div');
        trackDetails.style.flex = '1';
        trackDetails.style.minWidth = '0'; // Allows text to truncate

        const title = document.createElement('div');
        title.setAttribute('data-track-title', track.name || 'Unknown title');
        title.textContent = track.name || 'Unknown title';
        title.style.color = 'white';
        title.style.fontWeight = '600';
        title.style.fontSize = '14px';
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';

        const artist = document.createElement('div');
        artist.setAttribute('data-track-artist', track.artists?.[0]?.name || 'Unknown artist');
        artist.textContent = track.artists?.[0]?.name || 'Unknown artist';
        artist.style.color = '#ddd';
        artist.style.fontSize = '12px';
        artist.style.whiteSpace = 'nowrap';
        artist.style.overflow = 'hidden';
        artist.style.textOverflow = 'ellipsis';

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.alignItems = 'center';

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-btn';
        saveBtn.setAttribute('data-track-id', track.id);
        saveBtn.innerHTML = '+';
        
        // Creates save tooltip
        const saveTooltip = document.createElement('div');
        saveTooltip.className = 'save-tooltip';
        saveTooltip.textContent = currentUser ? 'Save song' : 'Login to save';
        saveBtn.appendChild(saveTooltip);
        
        saveBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSaveSong(
                track.id,
                track.name || 'Unknown title',
                track.artists?.[0]?.name || 'Unknown artist',
                track.album?.images?.[0]?.url || ''
            );
        };

        // Play button
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶';
        playBtn.style.background = '#ffffff';
        playBtn.style.border = 'none';
        playBtn.style.borderRadius = '50%';
        playBtn.style.width = '32px';
        playBtn.style.height = '32px';
        playBtn.style.color = 'purple';
        playBtn.style.cursor = 'pointer';
        playBtn.style.fontSize = '12px';
        playBtn.style.display = 'flex';
        playBtn.style.alignItems = 'center';
        playBtn.style.justifyContent = 'center';
        playBtn.style.flexShrink = '0';
        playBtn.style.position = 'relative';
        // Creates custom tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = 'Play with Spotify';
        playBtn.appendChild(tooltip);
        
        playBtn.onclick = (e) => {
            e.preventDefault();
            toggleTrackPlayback(track, playBtn);
        };

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(playBtn);

        trackDetails.appendChild(title);
        trackDetails.appendChild(artist);
        trackInfo.appendChild(trackDetails);
        trackInfo.appendChild(buttonContainer);

        card.appendChild(img);
        card.appendChild(trackInfo);
        list.appendChild(card);
    }

    container.appendChild(list);
    
    // Updates save button states after rendering (with a small delay to ensure DOM is ready)
    setTimeout(() => {
        updateAllSaveButtonStates();
    }, 10);
}

// Initializes main application
document.addEventListener('DOMContentLoaded', main);