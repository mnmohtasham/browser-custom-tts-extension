if (!window.kokoroReaderInjected) {
    window.kokoroReaderInjected = true;

    let isPlaying = false;
    let currentAudio = null;
    let audioQueue = [];

    const style = document.createElement('style');
    style.textContent = `
        #kokoro-reader-btn {
            position: fixed; bottom: 25px; right: 25px; width: 55px; height: 55px;
            color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 24px; z-index: 999999;
            transition: transform 0.2s ease, background-color 0.3s ease, box-shadow 0.3s ease;
            background-color: #ef4444; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
            font-family: Arial, sans-serif;
        }
        #kokoro-reader-btn:hover { transform: scale(1.15); }
        #kokoro-reader-btn.state-playing { background-color: #22c55e; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); }
        #kokoro-reader-btn.state-paused, #kokoro-reader-btn.state-fetching { background-color: #eab308; box-shadow: 0 4px 15px rgba(234, 179, 8, 0.4); }
    `;
    document.head.appendChild(style);

    const btn = document.createElement('div');
    btn.id = 'kokoro-reader-btn';
    btn.innerHTML = '▶';
    document.body.appendChild(btn);

    async function playNext() {
        if (!isPlaying || audioQueue.length === 0) {
            isPlaying = false;
            btn.className = ''; 
            btn.innerHTML = '▶';
            return;
        }

        const text = audioQueue.shift();
        btn.className = 'state-fetching';
        btn.innerHTML = '⏳';

        chrome.runtime.sendMessage({action: "fetchAudio", text}, (res) => {
            if (!res || !res.audioBase64 || !isPlaying) {
                btn.className = '';
                btn.innerHTML = '▶';
                return;
            }

            currentAudio = new Audio("data:audio/mp3;base64," + res.audioBase64);
            btn.className = 'state-playing';
            btn.innerHTML = '⏸';
            
            currentAudio.play();
            currentAudio.onended = playNext;
        });
    }

    btn.onclick = () => {
        if (isPlaying) {
            isPlaying = false;
            if (currentAudio) currentAudio.pause();
            btn.className = 'state-paused';
            btn.innerHTML = '▶';
        } else {
            isPlaying = true;
            
            // Only scrape text if the queue is empty AND audio isn't just paused
            if (audioQueue.length === 0 && (!currentAudio || currentAudio.ended)) {
                audioQueue = Array.from(document.querySelectorAll('p'))
                                  .map(p => p.innerText.trim())
                                  .filter(t => t.length > 50);
            }
            
            if (currentAudio && currentAudio.paused && !currentAudio.ended) {
                currentAudio.play();
                btn.className = 'state-playing';
                btn.innerHTML = '⏸';
            } else {
                playNext();
            }
        }
    };
}