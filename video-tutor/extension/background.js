// Relays requests from the YouTube page to the local backend. Running the fetch here
// (extension origin + host_permissions) avoids CORS / private-network blocks that a
// youtube.com page would hit when calling localhost.
const BACKEND_URL = "http://localhost:8787";

async function callBackend(path, payload) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(function badJson() { return {}; });
  if (!response.ok) throw new Error(body.error || `Backend error ${response.status}`);
  return body;
}

chrome.runtime.onMessage.addListener(function onMessage(message, _sender, sendResponse) {
  const path = { analyze: "/api/analyze", ask: "/api/ask" }[message.type];
  if (!path) return false;
  callBackend(path, message.payload)
    .then(function sendOk(data) { sendResponse({ ok: true, data }); })
    .catch(function sendError(error) {
      const hint = error instanceof TypeError ? " — is the backend running? (cd backend && npm run dev)" : "";
      sendResponse({ ok: false, error: `${error.message}${hint}` });
    });
  return true; // keep the channel open for the async response
});
