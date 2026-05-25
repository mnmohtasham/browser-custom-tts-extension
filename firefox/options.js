const apiUrlInput = document.getElementById('apiUrl');
const voiceSelect = document.getElementById('voiceId');
const speedInput = document.getElementById('speed');
const speedValLabel = document.getElementById('speedVal');
const saveBtn = document.getElementById('save');
const statusDiv = document.getElementById('status');
const voiceHint = document.getElementById('voiceHint');

const DEFAULT_VOICES = [
    "af_bella", "af_sarah", "am_adam", "am_michael", 
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
    "af_nicole", "af_sky", "am_eric", "am_liam"
];

// Load saved settings when page opens
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['apiUrl', 'voiceId', 'processingMode', 'speed'], (result) => {
        if (result.apiUrl) apiUrlInput.value = result.apiUrl;
        populateVoices(result.apiUrl, result.voiceId || 'af_bella');

        // Restore speed setting
        const speed = result.speed !== undefined ? result.speed : 1.0;
        speedInput.value = speed;
        speedValLabel.textContent = parseFloat(speed).toFixed(1) + 'x';

        // Restore processing mode
        if (result.processingMode === 'paragraph') {
            document.getElementById('modeParagraph').checked = true;
        } else {
            document.getElementById('modeWhole').checked = true;
        }
    });
});

// Update speed visual label in real-time as you drag the slider
speedInput.addEventListener('input', () => {
    speedValLabel.textContent = parseFloat(speedInput.value).toFixed(1) + 'x';
});

apiUrlInput.addEventListener('blur', () => {
    populateVoices(apiUrlInput.value, voiceSelect.value);
});

async function fetchVoicesFromAnyBackend(baseUrl) {
    const endpoints = [
        '/v1/audio/voices',  
        '/v1/voices',        
        '/api/voices',       
        '/api/tts/speakers'  
    ];

    for (let endpoint of endpoints) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`);
            if (response.ok) {
                return await response.json(); 
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
            
            if (data.voices && Array.isArray(data.voices)) extractedVoices = data.voices;
            else if (data.data && Array.isArray(data.data)) extractedVoices = data.data;
            else if (Array.isArray(data)) extractedVoices = data;

            if (extractedVoices.length > 0) {
                voices = extractedVoices.map(v => typeof v === 'object' ? (v.id || v.name || v.voice_id) : v);
                voiceHint.textContent = "✅ Voices successfully loaded from API.";
                voiceHint.style.color = "#10b981";
            } else {
                throw new Error("API returned an empty list.");
            }
            
        } catch (error) {
            voiceHint.textContent = "⚠️ Could not connect to API to fetch voices. Using default list.";
            voiceHint.style.color = "#eab308";
        }
    } else {
        voiceHint.textContent = "Uses default list. Enter a valid API URL to fetch available voices dynamically.";
        voiceHint.style.color = "#6b7280";
    }

    voiceSelect.innerHTML = '';
    voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice;
        option.textContent = voice;
        voiceSelect.appendChild(option);
    });

    if (voices.includes(selectedVoice)) {
        voiceSelect.value = selectedVoice;
    } else if (voices.length > 0) {
        voiceSelect.value = voices[0];
    }
}

saveBtn.addEventListener('click', () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
    const voiceId = voiceSelect.value;
    const speed = parseFloat(speedInput.value); // Convert to float value
    const processingMode = document.querySelector('input[name="processingMode"]:checked').value;

    chrome.storage.local.set({ apiUrl, voiceId, speed, processingMode }, () => {
        statusDiv.classList.add('visible');
        setTimeout(() => {
            statusDiv.classList.remove('visible');
        }, 2000);
    });
});