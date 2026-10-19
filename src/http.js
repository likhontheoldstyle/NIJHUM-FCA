import https from "https";
import { URLSearchParams } from "url";

export function post(url, headers, form) {
    return new Promise((resolve, reject) => {
        const body = new URLSearchParams(form).toString();
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                const cleaned = data.replace(/^for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
                try { resolve(JSON.parse(cleaned)); }
                catch { resolve({ raw: data }); }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

export function postFormData(url, headers, fields, files) {
    return new Promise((resolve, reject) => {
        const boundary = "----RikaFca" + Date.now().toString(16);
        const parts = [];
        for (const [k, v] of Object.entries(fields || {})) {
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
        }
        for (const [k, file] of Object.entries(files || {})) {
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="blob"\r\nContent-Type: application/octet-stream\r\n\r\n`));
            parts.push(file.data || file);
            parts.push(Buffer.from("\r\n"));
        }
        parts.push(Buffer.from(`--${boundary}--\r\n`));
        const body = Buffer.concat(parts);
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": body.length,
            },
        }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                const cleaned = data.replace(/^for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
                try { resolve(JSON.parse(cleaned)); }
                catch { resolve({ raw: data }); }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

export function get(url, headers) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        https.get({
            hostname: u.hostname,
            path: u.pathname + u.search,
            headers,
        }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on("error", reject);
    });
}
