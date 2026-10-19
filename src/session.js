export function appstateToCookieString(appstate) {
    if (typeof appstate === "string") {
        try { appstate = JSON.parse(appstate); } catch { return appstate; }
    }
    if (!Array.isArray(appstate)) return "";
    return appstate.map((c) => `${c.key}=${c.value}`).join("; ");
}

export function getUserIdFromAppstate(appstate) {
    if (typeof appstate === "string") {
        try { appstate = JSON.parse(appstate); } catch { return null; }
    }
    if (!Array.isArray(appstate)) return null;
    const c = appstate.find((x) => x.key === "c_user");
    return c ? c.value : null;
}

export function buildHeaders(cookieString, userAgent) {
    return {
        "Cookie": cookieString,
        "User-Agent": userAgent || "Mozilla/5.0 (Linux; Android 9; SM-G973U Build/PPR1.180610.011) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Mobile Safari/537.3",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.facebook.com",
        "Referer": "https://www.facebook.com/",
    };
}
