chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    }).catch(err => console.warn("Script injection handled:", err.message));
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchAudio") {
        (async () => {
            try {
                // Get Speed parameter alongside others
                const storage = await new Promise(r => chrome.storage.local.get(['apiUrl', 'voiceId', 'speed'], r));
                if (!storage.apiUrl) throw new Error("API URL not configured");

                const speedVal = storage.speed !== undefined ? parseFloat(storage.speed) : 1.0;
                let base = storage.apiUrl.replace(/\/$/, '');
                
                const response = await fetch(`${base}/v1/audio/speech`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        model: "kokoro", 
                        input: request.text, 
                        voice: storage.voiceId || "af_bella",
                        response_format: "mp3",
                        speed: speedVal // PASS SPEED PARAMETER HERE
                    })
                });

                if (!response.ok) throw new Error(`API Error: ${response.status}`);

                const buffer = await response.arrayBuffer();
                
                // Convert to base64 safely (Native engine file reader)
                const base64 = await new Promise((resolve, reject) => {
                    const blob = new Blob([buffer], { type: 'audio/mp3' });
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result;
                        resolve(dataUrl.substr(dataUrl.indexOf(',') + 1));
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                sendResponse({ audioBase64: base64 });
            } catch (e) {
                console.error("Background Fetch Error:", e);
                sendResponse({ error: e.message });
            }
        })();
        return true;
    }
});