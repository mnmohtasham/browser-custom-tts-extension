const apiUrlInput = document.getElementById('apiUrl');
const voiceSelect = document.getElementById('voiceId');
const saveBtn = document.getElementById('save');
const statusDiv = document.getElementById('status');
const voiceHint = document.getElementById('voiceHint');

// Standard Kokoro voices as a fallback
const DEFAULT_VOICES = [
    "af_bella", "af_sarah", "am_adam", "am_michael", 
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
    "af_nicole", "af_sky", "am_eric", "am_liam"
];

// Load saved settings when page opens
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['apiUrl', 'voiceId'], (result) => {
        if (result.apiUrl) apiUrlInput.value = result.apiUrl;
        populateVoices(result.apiUrl, result.voiceId || 'af_bella');
    });
});

// Re-fetch voices if user changes the API URL and clicks outside the input
apiUrlInput.addEventListener('blur', () => {
    populateVoices(apiUrlInput.value, voiceSelect.value);
});

// The function that hunts for the correct backend endpoint
async function fetchVoicesFromAnyBackend(baseUrl) {
    const endpoints = [
        '/v1/audio/voices',  // OpenAI compatible / Kokoro
        '/v1/voices',        // Generic TTS 
        '/api/voices',       // Common alternative wrapper
        '/api/tts/speakers'  // Other custom wrappers
    ];

    for (let endpoint of endpoints) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`);
            if (response.ok) {
                const data = await response.json();
                return data; // Success! Return the payload
            }
        } catch (e) {
            continue; 
        }
    }
    throw new Error("No valid voice endpoints found on this server.");
}

async function populateVoices(url, selectedVoice) {
    let voices = DEFAULT_VOICES;
    const cleanUrl = url ? url.trim().replace(/\/$/, '') : '';
    
    if (cleanUrl) {
        voiceHint.textContent = "⏳ Attempting to fetch voices...";
        voiceHint.style.color = "#6b7280";

        try {
            const data = await fetchVoicesFromAnyBackend(cleanUrl);
            let extractedVoices = [];
            if (data.voices && Array.isArray(data.voices)) {
                extractedVoices = data.voices;
            } else if (data.data && Array.isArray(data.data)) {
                extractedVoices = data.data;
            } else if (Array.isArray(data)) {
                extractedVoices = data;
            }

            if (extractedVoices.length > 0) {
                voices = extractedVoices.map(v => typeof v === 'object' ? (v.id || v.name || v.voice_id) : v);
                voiceHint.textContent = "✅ Voices successfully loaded from API.";
                voiceHint.style.color = "#10b981";
            } else {
                throw new Error("API returned an empty list.");
            }
            
        } catch (error) {
            console.warn("Could not fetch voices from API:", error);
            voiceHint.textContent = "⚠️ Could not connect to API to fetch voices. Using default list.";
            voiceHint.style.color = "#eab308";
        }
    } else {
        voiceHint.textContent = "Uses default list. Enter a valid API URL to fetch available voices dynamically.";
        voiceHint.style.color = "#6b7280";
    }

    // Clear and populate the select dropdown
    voiceSelect.innerHTML = '';
    voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice;
        option.textContent = voice;
        voiceSelect.appendChild(option);
    });

    // Restore previously selected voice if it exists in the updated list
    if (voices.includes(selectedVoice)) {
        voiceSelect.value = selectedVoice;
    } else if (voices.length > 0) {
        // If the old voice doesn't exist on this new server, pick the first available one
        voiceSelect.value = voices[0];
    }
}

// Save settings
saveBtn.addEventListener('click', () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, ''); // Clean URL
    const voiceId = voiceSelect.value;

    chrome.storage.local.set({ apiUrl, voiceId }, () => {
        statusDiv.classList.add('visible');
        setTimeout(() => {
            statusDiv.classList.remove('visible');
        }, 2000);
    });
});