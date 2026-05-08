chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchAudio") {
        chrome.storage.local.get(['apiUrl', 'voiceId'], async (data) => {
            try {
                let base = data.apiUrl || "https://tts.selfhostapps.com";
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

                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ audioBase64: reader.result.split(',')[1] });
                reader.readAsDataURL(blob);
            } catch (e) { sendResponse({ error: e.message }); }
        });
        return true;
    }
});