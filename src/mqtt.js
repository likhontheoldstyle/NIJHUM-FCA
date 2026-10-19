import mqtt from "mqtt";
import websocket from "websocket-stream";

const TOPICS = [
    "/t_ms",
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
            keepalive: 60,
            reschedulePings: true,
            reconnectPeriod: 3000,
        }
    );

    ctx.mqttClient = client;

    client.on("error", (err) => {
        onEvent({ type: "error", error: err.message || err }, null);
    });

    client.on("connect", () => {
        TOPICS.forEach((t) => client.subscribe(t));
        const queue = {
            sync_api_version: 10,
            max_deltas_able_to_process: 1000,
            delta_batch_size: 500,
            encoding: "JSON",
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
        const events = data.event === "delta" ? [data.delta] : data.deltas || [];
        for (const d of events) {
            const ev = parseDelta(d, ctx);
            if (ev) onEvent(null, ev);
        }
    } else if (data.ms) {
        for (const ms of data.ms) {
            const ev = parseDelta(ms.delta, ctx);
            if (ev) onEvent(null, ev);
        }
    }
}

function parseDelta(d, ctx) {
    if (!d) return null;
    const cls = d.class || d.deltaClass;
    if (cls === "NewMessage" || d.body) {
        const md = d.messageMetadata || {};
        return {
            type: d.replyToMessage ? "message_reply" : "message",
            threadID: md.threadKey?.threadFbId || md.threadKey?.otherUserFbId || "",
            messageID: md.messageId || "",
            senderID: md.actorFbId || "",
            body: d.body || "",
            timestamp: md.timestamp || Date.now(),
        };
    }
    if (cls === "ThreadName" || cls === "ParticipantsAddedToGroupThread") {
        return {
            type: "event",
            logMessageType: "log:subscribe",
            threadID: d.threadFbId || d.threadKey?.threadFbId || "",
            logMessageData: {
                addedParticipants: (d.addedParticipants || []).map((p) => ({
                    userFbId: p.userFbId || p,
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
