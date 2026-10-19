let fbDtsg = null;
let ttstamp = null;
let refreshTimer = null;
let reqCounter = 1;
let fetchFn = null;

export function setFetchFn(fn) {
    fetchFn = fn;
}

export function getFbDtsg() {
    return fbDtsg;
}

export function getTtstamp() {
    return ttstamp;
}

function calcTtstamp(dtsg) {
    let s = 0;
    for (let i = 0; i < dtsg.length; i++) s += dtsg.charCodeAt(i);
    return "2" + s;
}

function extractDtsg(html) {
    let m = html.match(/name="fb_dtsg" value="([^"]+)"/);
    if (m) return { dtsg: m[1], ttstamp: null };
    m = html.match(/"dtsg":"([^"]+)"/);
    if (m) {
        const dtsg = m[1];
        const sm = html.match(/"sprinkleValue":"([^"]+)"/);
        return { dtsg, ttstamp: sm ? "2" + sm[1] : null };
    }
    m = html.match(/"dtsg":\{"token":"([^"]+)"\}/);
    if (m) return { dtsg: m[1], ttstamp: null };
    return null;
}

export async function fetchFbDtsg(headers) {
    if (!fetchFn) return null;
    try {
        const res = await fetchFn("https://www.facebook.com/", headers);
        const html = res.body || "";
        const extracted = extractDtsg(html);
        if (extracted) {
            fbDtsg = extracted.dtsg;
            ttstamp = extracted.ttstamp || calcTtstamp(extracted.dtsg);
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

export function withDtsg(form, userID) {
    if (fbDtsg) form.fb_dtsg = fbDtsg;
    if (ttstamp) form.jazoest = ttstamp;
    if (userID) form.__user = userID;
    form.__a = 1;
    form.__req = (reqCounter++).toString(36);
    return form;
}
