(function() {
    if (window.kokoroReaderInjected) return;
    window.kokoroReaderInjected = true;

    let isPlaying = false;
    let currentAudio = null;
    let currentBlobUrl = null; 
    let audioQueue = [];
    let isDraggingSlider = false;

    // --- 1. INJECT STYLES ---
    const style = document.createElement('style');
    style.textContent = `
        #kokoro-reader-container {
            position: fixed; bottom: 25px; right: 25px; z-index: 999999;
            display: flex; flex-direction: column; align-items: center;
            font-family: Arial, sans-serif; user-select: none;
        }
        #kokoro-controls {
            opacity: 0; visibility: hidden; transform: translateY(10px);
            background: white; border-radius: 8px; padding: 10px 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); margin-bottom: 12px; 
            display: flex; align-items: center; gap: 10px;
            transition: opacity 0.3s, visibility 0.3s, transform 0.3s;
            border: 1px solid #e5e7eb;
        }
        #kokoro-reader-container:hover #kokoro-controls { opacity: 1; visibility: visible; transform: translateY(0); }
        #kokoro-seek-bar { width: 150px; cursor: pointer; accent-color: #ef4444; margin: 0; }
        .kokoro-time { font-size: 12px; font-weight: bold; color: #4b5563; min-width: 35px; text-align: center; }
        #kokoro-reader-btn {
            width: 55px; height: 55px; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 24px; transition: transform 0.2s ease, background-color 0.3s ease, box-shadow 0.3s ease;
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

    const controls = document.createElement('div');
    controls.id = 'kokoro-controls';
    controls.innerHTML = `
        <span id="kokoro-time-current" class="kokoro-time">0:00</span>
        <input type="range" id="kokoro-seek-bar" min="0" max="100" value="0" step="0.1" disabled>
        <span id="kokoro-time-total" class="kokoro-time">0:00</span>
    `;

    const btn = document.createElement('div');
    btn.id = 'kokoro-reader-btn';
    btn.innerHTML = '▶';

    container.appendChild(controls);
    container.appendChild(btn);
    document.body.appendChild(container);

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
        seekBar.value = 0; seekBar.max = 100; seekBar.disabled = true;
        timeCurrent.innerText = "0:00"; timeTotal.innerText = "0:00";
    }

    // --- 4. SMART ARTICLE EXTRACTOR ---
    function extractMainArticleText() {
        const selectors = [
            'article', '[role="main"]', 'main',
            '.post-content', '.entry-content', '.article-body', '.story-content',
            '#article-body', '#main-content', '.post-content-body', '.mw-parser-output'
        ];

        let bestContainer = null;
        let highestScore = 0;

        document.querySelectorAll(selectors.join(', ')).forEach(el => {
            const pCount = el.querySelectorAll('p').length;
            const textLen = el.innerText.length;
            const score = pCount * textLen;
            if (score > highestScore) {
                highestScore = score;
                bestContainer = el;
            }
        });

        if (!bestContainer || highestScore === 0) {
            bestContainer = document.body;
        }

        const rawElements = Array.from(bestContainer.querySelectorAll('p, h1, h2, h3, h4, li, blockquote'));

        const validTexts = rawElements.filter(el => {
            if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;

            const badContainers = 'nav, footer, header, aside, form, .comments, #comments, .related, .share, .ad, .promo, .newsletter, [role="navigation"]';
            if (el.closest(badContainers)) return false;

            const links = el.querySelectorAll('a');
            let linkTextLength = 0;
            links.forEach(a => linkTextLength += a.innerText.length);
            const totalTextLength = el.innerText.trim().length;
            
            if (totalTextLength > 0 && (linkTextLength / totalTextLength) > 0.4) {
                return false; 
            }

            if (totalTextLength < 25) return false;

            return true;
        }).map(el => el.innerText.trim());

        return validTexts;
    }

    // --- 5. SLIDER INTERACTION LOGIC ---
    seekBar.addEventListener('mousedown', () => isDraggingSlider = true);
    seekBar.addEventListener('touchstart', () => isDraggingSlider = true, {passive: true});
    seekBar.addEventListener('mouseup', () => isDraggingSlider = false);
    seekBar.addEventListener('touchend', () => isDraggingSlider = false);
    
    seekBar.addEventListener('input', () => {
        timeCurrent.innerText = formatTime(seekBar.value);
        if (currentAudio) {
            currentAudio.currentTime = parseFloat(seekBar.value);
        }
    });

    // --- 6. AUDIO PLAYBACK LOGIC ---
    async function playNext() {
        if (audioQueue.length === 0) {
            isPlaying = false;
            btn.className = ''; 
            btn.innerHTML = '▶';
            resetSlider();
            currentAudio = null; // FIX: Wipe audio from memory so next click starts fresh
            return;
        }

        const text = audioQueue.shift(); 
        
        btn.className = 'state-fetching';
        btn.innerHTML = '⏳';
        resetSlider();

        chrome.runtime.sendMessage({action: "fetchAudio", text}, (res) => {
            if (!isPlaying) return;

            if (!res || res.error) {
                console.error("Audio fetch failed: ", res?.error);
                btn.className = ''; btn.innerHTML = '▶';
                alert("Failed to generate audio. The text might be too long for your API, or the server is down.");
                return;
            }

            const binaryString = atob(res.audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: 'audio/mpeg' });
            
            if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = URL.createObjectURL(blob);

            currentAudio = new Audio(currentBlobUrl);
            btn.className = 'state-playing';
            btn.innerHTML = '⏸';

            currentAudio.addEventListener('loadedmetadata', () => {
                seekBar.max = currentAudio.duration;
                timeTotal.innerText = formatTime(currentAudio.duration);
                seekBar.disabled = false;
            });

            currentAudio.addEventListener('timeupdate', () => {
                if (!isDraggingSlider) {
                    seekBar.value = currentAudio.currentTime;
                    timeCurrent.innerText = formatTime(currentAudio.currentTime);
                }
            });

            currentAudio.play();
            currentAudio.onended = () => playNext();
        });
    }

    // --- 7. BUTTON LOGIC ---
    btn.onclick = async () => {
        if (isPlaying) {
            isPlaying = false;
            if (currentAudio) currentAudio.pause();
            btn.className = 'state-paused';
            btn.innerHTML = '▶';
        } else {
            isPlaying = true;
            
            // Queue will build fresh because currentAudio is wiped when finished
            if (audioQueue.length === 0 && !currentAudio) {
                const result = await new Promise(resolve => chrome.storage.local.get('processingMode', resolve));
                const mode = result.processingMode || 'whole'; 

                const validTexts = extractMainArticleText();

                if (mode === 'whole') {
                    audioQueue = [validTexts.join("\n\n")];
                } else {
                    audioQueue = validTexts;
                }
            }
            
            if (currentAudio && currentAudio.paused) {
                currentAudio.play();
                btn.className = 'state-playing';
                btn.innerHTML = '⏸';
            } else {
                playNext(); 
            }
        }
    };
})();