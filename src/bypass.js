let enabled = true;
let lastAction = 0;

export function setBypassEnabled(v) {
    enabled = !!v;
}

export function isBypassEnabled() {
    return enabled;
}

export async function humanDelay(minMs = 800, maxMs = 2500) {
    if (!enabled) return;
    const now = Date.now();
    const sinceLast = now - lastAction;
    const base = minMs + Math.random() * (maxMs - minMs);
    const wait = Math.max(0, base - sinceLast);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAction = Date.now();
}

export function humanHeaders(baseHeaders) {
    if (!enabled) return baseHeaders;
    return {
        ...baseHeaders,
        "Sec-Ch-Ua": '"Chromium";v="120", "Not(A:Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": '"Android"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    };
}

export function jitteredKeepalive(baseSeconds = 60) {
    if (!enabled) return baseSeconds;
    return baseSeconds + Math.floor(Math.random() * 15) - 7;
}
