let isPlaying = false;
let currentAudio = null;
let audioQueue = [];

// 1. Inject CSS for hover animations and state colors
const style = document.createElement('style');
style.textContent = `
    #kokoro-reader-btn {
        position: fixed;
        bottom: 25px;
        right: 25px;
        width: 55px;
        height: 55px;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 24px;
        z-index: 999999;
        /* Animation properties */
        transition: transform 0.2s ease, background-color 0.3s ease, box-shadow 0.3s ease;
        
        /* Initial State: Red */
        background-color: #ef4444; 
        box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    }

    /* Hover Animation */
    #kokoro-reader-btn:hover {
        transform: scale(1.15);
    }

    /* Playing State: Green */
    #kokoro-reader-btn.state-playing {
        background-color: #22c55e;
        box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
    }

    /* Paused / Fetching State: Yellow */
    #kokoro-reader-btn.state-paused,
    #kokoro-reader-btn.state-fetching {
        background-color: #eab308;
        box-shadow: 0 4px 15px rgba(234, 179, 8, 0.4);
    }
`;
document.head.appendChild(style);

// 2. Create the Button
const btn = document.createElement('div');
btn.id = 'kokoro-reader-btn';
btn.innerHTML = '▶'; // Initial Icon
document.body.appendChild(btn);

// 3. Original Logic with added class changes for color
async function playNext() {
    if (!isPlaying || audioQueue.length === 0) {
        isPlaying = false;
        btn.className = ''; // Remove all classes (Reverts to Initial Red)
        btn.innerHTML = '▶';
        return;
    }

    const text = audioQueue.shift();
    btn.className = 'state-fetching'; // Turns Yellow
    btn.innerHTML = '⏳';

    chrome.runtime.sendMessage({action: "fetchAudio", text}, (res) => {
        if (!res || !res.audioBase64 || !isPlaying) {
            btn.className = ''; // Revert to Initial Red on failure/stop
            btn.innerHTML = '▶';
            return;
        }

        currentAudio = new Audio("data:audio/mp3;base64," + res.audioBase64);
        btn.className = 'state-playing'; // Turns Green
        btn.innerHTML = '⏸';
        
        currentAudio.play();
        currentAudio.onended = playNext;
    });
}

btn.onclick = () => {
    if (isPlaying) {
        // Pause action
        isPlaying = false;
        if (currentAudio) currentAudio.pause();
        btn.className = 'state-paused'; // Turns Yellow
        btn.innerHTML = '▶';
    } else {
        // Play action
        isPlaying = true;
        // Collect paragraphs fresh every time
        audioQueue = Array.from(document.querySelectorAll('p'))
                          .map(p => p.innerText.trim())
                          .filter(t => t.length > 50);
        playNext();
    }
};