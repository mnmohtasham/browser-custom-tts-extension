chrome.browserAction.onClicked.addListener((tab) => {
    // This alert will appear in the browser if the button works
    // If you don't see this, the browser isn't registering your click
    console.log("Extension icon clicked!");
    
    // Inject and send a test message to prove connection
    chrome.tabs.executeScript(tab.id, { file: 'content.js' }, () => {
        if (chrome.runtime.lastError) {
            console.error("Injection failed:", chrome.runtime.lastError.message);
        } else {
            console.log("Injection successful!");
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchAudio") {
        chrome.storage.local.get(['apiUrl', 'voiceId'], (data) => {
            // Ensure the URL does not end in a slash before adding /v1/...
            let base = data.apiUrl;
            if (base.endsWith('/')) base = base.slice(0, -1);
            
            const url = `${base}/v1/audio/speech`;
            console.log("Fetching from:", url); // This will appear in the background console
            
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "kokoro",
                    input: request.text,
                    voice: data.voiceId || "af_bella",
                    response_format: "wav"
                })
            })
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Server returned ${res.status}: ${text}`);
                }
                return res.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ audioBase64: reader.result.split(',')[1] });
                reader.readAsDataURL(blob);
            })
            .catch(err => {
                console.error("Fetch Error:", err);
                sendResponse({ error: err.message });
            });
        });
        return true; 
    }
});