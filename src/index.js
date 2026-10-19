import { appstateToCookieString, getUserIdFromAppstate, buildHeaders } from "./session.js";
import { get } from "./http.js";
import { buildApi } from "./api.js";
import { startAutoRefresh, stopAutoRefresh } from "./dtsg.js";
import { setBypassEnabled, humanHeaders } from "./bypass.js";

export default function login(loginData, options, callback) {
    if (typeof options === "function") {
        callback = options;
        options = {};
    }
    options = options || {};
    if (options.bypassAutomationBehavior === false) setBypassEnabled(false);
    const p = (async () => {
        const appstate = loginData.appState || loginData.appstate;
        if (!appstate) throw { error: "No appstate provided" };
        const cookieString = appstateToCookieString(appstate);
        const userID = getUserIdFromAppstate(appstate);
        if (!userID) throw { error: "Could not get user ID from appstate" };
        let headers = buildHeaders(cookieString, options.userAgent);
        headers = humanHeaders(headers);
        const check = await get("https://www.facebook.com/", headers);
        if (check.status !== 200) throw { error: "Login failed: session invalid (HTTP " + check.status + ")" };
        const ctx = {
            userID: String(userID),
            cookieString,
            headers,
            options,
            mqttClient: null,
            appstate,
        };
        if (options.autoRefreshFbDtsg !== false) startAutoRefresh(headers);
        return buildApi(ctx);
    })();
    if (callback) p.then((api) => callback(null, api)).catch((e) => callback(e));
    return p;
}

export { login };
export { stopAutoRefresh };
