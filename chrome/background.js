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
                
                // PERFORMANCE FIX: Processing large arrays in chunks prevents 'Max call stack' & UI freezes
                let binary = '';
                const bytes = new Uint8Array(arrayBuffer);
                const chunkSize = 0x8000; // 32768
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
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