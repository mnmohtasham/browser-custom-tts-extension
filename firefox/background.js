// Listen for the user clicking the extension icon in the toolbar
chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchAudio") {
        chrome.storage.local.get(['apiUrl', 'voiceId'], async (data) => {
            try {
                let base = data.apiUrl;
                if (base.endsWith('/')) base = base.slice(0, -1);
                
                const response = await fetch(`${base}/v1/audio/speech`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        model: "kokoro", 
                        input: request.text, 
                        voice: data.voiceId || "af_bella",
                        response_format: "mp3"
                    })
                });

                if (!response.ok) throw new Error(`API Error: ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(arrayBuffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);

                sendResponse({ audioBase64: base64 });
            } catch (e) { 
                sendResponse({ error: e.message }); 
            }
        });
        return true;
    }
});