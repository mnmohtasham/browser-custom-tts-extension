// Prevent duplicate buttons if the user clicks the extension icon multiple times
if (!window.kokoroReaderInjected) {
    window.kokoroReaderInjected = true;

    let isPlaying = false;
    let currentAudio = null;
    let audioQueue = [];
    let isDraggingSlider = false;

    // --- 1. INJECT STYLES ---
    const style = document.createElement('style');
    style.textContent = `
        #kokoro-reader-container {
            position: fixed; bottom: 25px; right: 25px; z-index: 999999;
            display: flex; flex-direction: column; align-items: center;
            font-family: Arial, sans-serif;
            user-select: none;
        }
        #kokoro-controls {
            opacity: 0; visibility: hidden; transform: translateY(10px);
            background: white; border-radius: 8px; padding: 10px 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            margin-bottom: 12px; display: flex; align-items: center; gap: 10px;
            transition: opacity 0.3s, visibility 0.3s, transform 0.3s;
            border: 1px solid #e5e7eb;
        }
        #kokoro-reader-container:hover #kokoro-controls {
            opacity: 1; visibility: visible; transform: translateY(0);
        }
        #kokoro-seek-bar {
            width: 150px; cursor: pointer;
            accent-color: #ef4444; /* Match main button color */
            margin: 0;
        }
        .kokoro-time {
            font-size: 12px; font-weight: bold; color: #4b5563;
            min-width: 35px; text-align: center;
        }
        #kokoro-reader-btn {
            width: 55px; height: 55px;
            color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 24px; 
            transition: transform 0.2s ease, background-color 0.3s ease, box-shadow 0.3s ease;
            background-color: #ef4444; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
        }
        #kokoro-reader-btn:hover { transform: scale(1.15); }
        #kokoro-reader-btn.state-playing { background-color: #22c55e; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); }
        #kokoro-reader-btn.state-paused, #kokoro-reader-btn.state-fetching { background-color: #eab308; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.4); }
    `;
    document.head.appendChild(style);

    // --- 2. CREATE UI ELEMENTS ---
    const container = document.createElement('div');
    container.id = 'kokoro-reader-container';

    // The Hover Popup with Slider
    const controls = document.createElement('div');
    controls.id = 'kokoro-controls';
    controls.innerHTML = `
        <span id="kokoro-time-current" class="kokoro-time">0:00</span>
        <input type="range" id="kokoro-seek-bar" min="0" max="100" value="0" step="0.1" disabled>
        <span id="kokoro-time-total" class="kokoro-time">0:00</span>
    `;

    // The Main Play Button
    const btn = document.createElement('div');
    btn.id = 'kokoro-reader-btn';
    btn.innerHTML = '▶';

    container.appendChild(controls);
    container.appendChild(btn);
    document.body.appendChild(container);

    // Grab references to slider elements
    const seekBar = document.getElementById('kokoro-seek-bar');
    const timeCurrent = document.getElementById('kokoro-time-current');
    const timeTotal = document.getElementById('kokoro-time-total');

    // --- 3. HELPER FUNCTIONS ---
    function formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function resetSlider() {
        seekBar.value = 0;
        seekBar.max = 100;
        seekBar.disabled = true;
        timeCurrent.innerText = "0:00";
        timeTotal.innerText = "0:00";
    }

    // --- 4. SLIDER INTERACTION LOGIC ---
    seekBar.addEventListener('mousedown', () => isDraggingSlider = true);
    seekBar.addEventListener('mouseup', () => isDraggingSlider = false);
    
    // Listen to slider drag (input updates continuously while dragging)
    seekBar.addEventListener('input', () => {
        timeCurrent.innerText = formatTime(seekBar.value);
        if (currentAudio) {
            currentAudio.currentTime = parseFloat(seekBar.value);
        }
    });

    // --- 5. AUDIO PLAYBACK LOGIC ---
    async function playNext() {
        if (!isPlaying || audioQueue.length === 0) {
            isPlaying = false;
            btn.className = '';
            btn.innerHTML = '▶';
            resetSlider();
            return;
        }

        const text = audioQueue.shift();
        btn.className = 'state-fetching';
        btn.innerHTML = '⏳';
        resetSlider();

        // 120s timeout in case API gets stuck
        const fetchTimeout = setTimeout(() => {
            if (isPlaying) { 
                btn.className = '';
                btn.innerHTML = '▶';
                console.error("TTS Fetch timed out. API might be overloaded or text is too large.");
            }
        }, 120000); 

        chrome.runtime.sendMessage({action: "fetchAudio", text}, (res) => {
            clearTimeout(fetchTimeout);
            if (!res || res.error || !res.audioBase64 || !isPlaying) {
                console.error("Audio fetch failed: ", res?.error);
                btn.className = '';
                btn.innerHTML = '▶';
                return;
            }

            // Init Audio
            currentAudio = new Audio("data:audio/mp3;base64," + res.audioBase64);
            btn.className = 'state-playing';
            btn.innerHTML = '⏸';

            // When audio metadata loads, set up slider max duration
            currentAudio.addEventListener('loadedmetadata', () => {
                // Workaround for some Chromium instances returning Infinity for DataURI durations
                if (currentAudio.duration === Infinity) {
                    currentAudio.currentTime = 1e101;
                    currentAudio.addEventListener('timeupdate', function getRealDuration() {
                        this.currentTime = 0;
                        seekBar.max = this.duration;
                        timeTotal.innerText = formatTime(this.duration);
                        seekBar.disabled = false;
                        this.removeEventListener('timeupdate', getRealDuration);
                    });
                } else {
                    seekBar.max = currentAudio.duration;
                    timeTotal.innerText = formatTime(currentAudio.duration);
                    seekBar.disabled = false;
                }
            });

            // Sync audio current time with slider (only if user isn't actively dragging it)
            currentAudio.addEventListener('timeupdate', () => {
                if (!isDraggingSlider) {
                    seekBar.value = currentAudio.currentTime;
                    timeCurrent.innerText = formatTime(currentAudio.currentTime);
                }
            });

            currentAudio.play();
            
            // Loop / Finish logic
            currentAudio.onended = () => {
                if (audioQueue.length === 0) {
                    isPlaying = false;
                    btn.className = '';
                    btn.innerHTML = '▶';
                    resetSlider();
                } else {
                    playNext();
                }
            };
        });
    }

    // --- 6. MAIN PLAY/PAUSE BUTTON LOGIC ---
    btn.onclick = async () => {
        if (isPlaying) {
            // Pause
            isPlaying = false;
            if (currentAudio) currentAudio.pause();
            btn.className = 'state-paused';
            btn.innerHTML = '▶';
        } else {
            // Play
            isPlaying = true;
            
            // Generate queue asynchronously IF empty
            if (audioQueue.length === 0 && (!currentAudio || currentAudio.ended)) {
                // Await storage response so playNext doesn't trigger prematurely
                const result = await new Promise(resolve => chrome.storage.local.get('processingMode', resolve));
                const mode = result.processingMode || 'whole'; 
                let textsToProcess = [];

                if (mode === 'whole') {
                    const fullText = Array.from(document.querySelectorAll('p'))
                                 .map(p => p.innerText.trim())
                                 .filter(t => t.length > 50)
                                 .join(' '); 
                    if (fullText) textsToProcess = [fullText];
                } else { 
                    textsToProcess = Array.from(document.querySelectorAll('p'))
                                  .map(p => p.innerText.trim())
                                  .filter(t => t.length > 50);
                }

                audioQueue = textsToProcess;
            }
            
            // Resume if paused
            if (currentAudio && currentAudio.paused && !currentAudio.ended) {
                currentAudio.play();
                btn.className = 'state-playing';
                btn.innerHTML = '⏸';
            } else {
                playNext(); // Start queue
            }
        }
    };
}