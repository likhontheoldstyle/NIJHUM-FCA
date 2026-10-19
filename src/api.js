import { post, postFormData } from "./http.js";

function parseRes(res) {
    if (res.error && res.error !== 0) throw res;
    return res;
}

export function buildApi(ctx) {
    const { headers } = ctx;

    return {
        getCurrentUserID() {
            return ctx.userID;
        },

        listenMqtt(callback) {
            import("./mqtt.js").then(({ listenMqtt }) => {
                listenMqtt(ctx, (err, event) => {
                    if (err) return callback(err, null);
                    callback(null, event);
                });
            });
        },

        sendMessage(msg, threadID, callback, replyToMessageID) {
            const p = (async () => {
                let body = "";
                let attachmentIds = [];
                if (typeof msg === "string") body = msg;
                else {
                    body = msg.body || "";
                    if (msg.attachment) {
                        const chunks = [];
                        for await (const c of msg.attachment) chunks.push(c);
                        const buf = Buffer.concat(chunks);
                        const up = await postFormData(
                            "https://upload.facebook.com/ajax/mercury/upload.php",
                            headers,
                            {},
                            { upload_1024: buf }
                        );
                        parseRes(up);
                        const meta = up.payload?.metadata?.[0];
                        if (!meta) throw { error: "Upload failed" };
                        attachmentIds.push(meta);
                    }
                }
                const form = {
                    thread_fbid: threadID,
                    message_text: body,
                    client: "mercury",
                };
                if (replyToMessageID) form.reply_to_message_id = replyToMessageID;
                attachmentIds.forEach((a, i) => {
                    form[`attachment[${i}][id]`] = a.id || a;
                });
                const res = await post("https://www.facebook.com/messaging/send/", headers, form);
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        setMessageReaction(emoji, messageID, callback, force) {
            const p = (async () => {
                const form = {
                    message_id: messageID,
                    reaction: emoji,
                };
                const res = await post("https://www.facebook.com/messaging/set_message_reaction/", headers, form);
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeNickname(nickname, threadID, participantID, callback) {
            const p = (async () => {
                const form = {
                    nickname,
                    participant_id: participantID,
                    thread_or_other_fbid: threadID,
                };
                const res = await post(
                    "https://www.facebook.com/messaging/save_thread_nickname/?source=thread_settings&dpr=1",
                    headers,
                    form
                );
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },
    };
}
