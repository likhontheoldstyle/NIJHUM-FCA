import { get } from "./http.js";

let fbDtsg = null;
let refreshTimer = null;

export function getFbDtsg() {
    return fbDtsg;
}

async function fetchFbDtsg(headers) {
    try {
        const res = await get("https://www.facebook.com/", headers);
        const m = res.body.match(/"dtsg":\{"token":"([^"]+)"\}/) || res.body.match(/name="fb_dtsg" value="([^"]+)"/);
        if (m) {
            fbDtsg = m[1];
            return fbDtsg;
        }
    } catch {}
    return null;
}

export function startAutoRefresh(headers, intervalMs = 3600000) {
    stopAutoRefresh();
    fetchFbDtsg(headers);
    refreshTimer = setInterval(() => fetchFbDtsg(headers), intervalMs);
}

export function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}

export function withDtsg(form) {
    if (fbDtsg) form.fb_dtsg = fbDtsg;
    return form;
}
