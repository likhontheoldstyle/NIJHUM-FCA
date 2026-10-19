import mqtt from "mqtt";
import websocket from "websocket-stream";
import { jitteredKeepalive } from "./bypass.js";

const TOPICS = [
    "/legacy_web",
    "/webrtc",
    "/rtc_multi",
    "/onevc",
    "/br_sr",
    "/sr_res",
    "/t_ms",
    "/thread_typing",
    "/orca_typing_notifications",
    "/notify_disconnect",
    "/messaging_events",
    "/orca_message_notifications",
    "/mercury",
];

function getGuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export function listenMqtt(ctx, onEvent) {
    const sessionID = Math.floor(Math.random() * 9007199254740991) + 1;
    const guid = getGuid();
    const username = {
        u: ctx.userID,
        s: sessionID,
        chat_on: ctx.options.online !== false,
        fg: false,
        d: guid,
        ct: "websocket",
        aid: "219994525426954",
        mqtt_sid: "",
        cp: 3,
        ecp: 10,
        st: [],
        pm: [],
        dc: "",
        no_auto_fg: true,
        gas: null,
        pack: [],
    };

    const host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${guid}`;
    const wsOptions = {
        headers: {
            Cookie: ctx.cookieString,
            Origin: "https://www.facebook.com",
            "User-Agent": ctx.headers["User-Agent"],
            Referer: "https://www.facebook.com/",
            Host: "edge-chat.facebook.com",
        },
        origin: "https://www.facebook.com",
        protocolVersion: 13,
    };

    const client = new mqtt.Client(
        (_) => websocket(host, wsOptions),
        {
            clientId: "mqttwsclient",
            protocolId: "MQIsdp",
            protocolVersion: 3,
            username: JSON.stringify(username),
            clean: true,
            keepalive: jitteredKeepalive(60),
            reschedulePings: true,
            reconnectPeriod: 3000,
        }
    );

    ctx.mqttClient = client;

    client.on("error", (err) => {
        onEvent(null, { type: "error", error: err.message || String(err) });
    });

    client.on("connect", () => {
        TOPICS.forEach((t) => client.subscribe(t));
        const queue = {
            sync_api_version: 10,
            max_deltas_able_to_process: 1000,
            delta_batch_size: 500,
            encoding: "JSON",
            entity_fbid: ctx.userID,
        };
        client.publish("/messenger_sync_create_queue", JSON.stringify(queue), { qos: 1, retain: false });
    });

    client.on("message", (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            handleMqttMessage(data, ctx, onEvent);
        } catch {}
    });

    return client;
}

function handleMqttMessage(data, ctx, onEvent) {
    if (data.type === "messaging" || data.type === "orca_message_notifications") {
        const events = data.event === "delta" ? [{ delta: data.delta }] : (data.deltas || []).map(d => ({ delta: d }));
        for (const v of events) {
            const ev = parseDelta(v, ctx);
            if (ev) onEvent(null, ev);
        }
    } else if (data.ms) {
        for (const ms of data.ms) {
            const ev = parseDelta(ms, ctx);
            if (ev) onEvent(null, ev);
        }
    } else if (data.delta) {
        const ev = parseDelta(data, ctx);
        if (ev) onEvent(null, ev);
    }
}

function formatID(id) {
    if (id != undefined && id != null) return String(id).replace(/(fb)?id[:.]/, "");
    return id;
}

function parseDelta(d, ctx) {
    if (!d) return null;
    const delta = d.delta || d;
    const cls = delta.class || d.class;
    if (cls === "NewMessage") {
        const md = delta.messageMetadata || {};
        const body = delta.body || "";
        const threadID = formatID((md.threadKey?.threadFbId || md.threadKey?.otherUserFbId || "").toString());
        return {
            type: "message",
            senderID: formatID((md.actorFbId || "").toString()),
            threadID,
            messageID: md.messageId || "",
            args: body === "" ? [] : body.trim().split(/\s+/),
            body,
            attachments: delta.attachments || [],
            mentions: {},
            timestamp: md.timestamp || Date.now(),
            isGroup: !!md.threadKey?.threadFbId,
            participantIDs: delta.participants || [],
        };
    }
    if (cls === "ThreadName" || cls === "ParticipantsAddedToGroupThread") {
        return {
            type: "event",
            logMessageType: "log:subscribe",
            threadID: formatID((delta.threadFbId || delta.threadKey?.threadFbId || "").toString()),
            logMessageData: {
                addedParticipants: (delta.addedParticipants || []).map((p) => ({
                    userFbId: formatID((p.userFbId || p).toString()),
                })),
            },
        };
    }
    return null;
}

export function stopListen(ctx) {
    if (ctx.mqttClient) {
        try { ctx.mqttClient.end(); } catch {}
        ctx.mqttClient = null;
    }
}
