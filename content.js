if (!document.getElementById('kokoro-panel')) {
    const panel = document.createElement('div');
    panel.id = 'kokoro-panel';
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
        background: #f8f9fa; border: 1px solid #ccc; border-radius: 8px;
        padding: 15px; width: 250px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif; color: #333;
    `;

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <strong style="font-size: 14px;">Kokoro Reader</strong>
            <button id="k-close" style="background:none; border:none; cursor:pointer; font-size:16px;">❌</button>
        </div>
        <div id="k-settings" style="margin-bottom: 10px; font-size: 12px;">
            <label>API URL:</label>
            <input type="text" id="k-api" style="width: 100%; margin-bottom: 5px;" placeholder="http://192.168.1.100:8880">
            <label>Voice ID:</label>
            <input type="text" id="k-voice" style="width: 100%; margin-bottom: 5px;">
            <button id="k-save" style="width: 100%; padding: 5px; cursor: pointer;">Save Settings</button>
        </div>
        <button id="k-play" style="width: 100%; padding: 10px; font-weight: bold; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">▶️ Read Page</button>
    `;
    
    document.body.appendChild(panel);

    let audioQueue = [];
    let isPlaying = false;
    let currentAudio = null;
    
    const playBtn = document.getElementById('k-play');
    const closeBtn = document.getElementById('k-close');
    const apiInput = document.getElementById('k-api');
    const voiceInput = document.getElementById('k-voice');
    const saveBtn = document.getElementById('k-save');

    chrome.storage.local.get(['apiUrl', 'voiceId'], (data) => {
        apiInput.value = data.apiUrl || "http://localhost:8880";
        voiceInput.value = data.voiceId || "af_bella";
    });

    saveBtn.addEventListener('click', () => {
        chrome.storage.local.set({ apiUrl: apiInput.value, voiceId: voiceInput.value });
        saveBtn.innerText = "Saved!";
        setTimeout(() => saveBtn.innerText = "Save Settings", 2000);
    });

    closeBtn.addEventListener('click', () => {
        if(currentAudio) currentAudio.pause();
        panel.remove();
    });

    function extractText() {
        const elements = document.querySelectorAll('p, article');
        let textChunks = [];
        elements.forEach(el => {
            let text = el.innerText.trim();
            if (text.length > 30 && !textChunks.includes(text)) textChunks.push(text);
        });
        return textChunks;
    }

    function playNextChunk() {
        if (audioQueue.length === 0) {
            playBtn.innerHTML = '▶️ Finished';
            isPlaying = false;
            return;
        }

        chrome.runtime.sendMessage({ action: "fetchAudio", text: audioQueue.shift() }, (response) => {
            if (!response || response.error) {
                playBtn.innerHTML = '❌ Check API/CORS';
                isPlaying = false;
                return;
            }
            const binStr = atob(response.audioBase64);
            const arr = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) arr[i] = binStr.charCodeAt(i);
            
            currentAudio = new Audio(URL.createObjectURL(new Blob([arr], { type: 'audio/wav' })));
            isPlaying = true;
            playBtn.innerHTML = '⏸️ Playing';
            currentAudio.play();
            currentAudio.onended = playNextChunk;
        });
    }

    playBtn.addEventListener('click', () => {
        if (isPlaying && currentAudio) {
            currentAudio.pause();
            isPlaying = false;
            playBtn.innerHTML = '▶️ Paused';
        } else if (!isPlaying && currentAudio) {
            currentAudio.play();
            isPlaying = true;
            playBtn.innerHTML = '⏸️ Playing';
        } else {
            audioQueue = extractText();
            if (audioQueue.length === 0) return alert("No text found.");
            playBtn.innerHTML = '⏳ Loading...';
            playNextChunk();
        }
    });
}
