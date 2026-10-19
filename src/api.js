import { post, postFormData } from "./http.js";
import { withDtsg } from "./dtsg.js";
import { humanDelay } from "./bypass.js";

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
            let client = null;
            import("./mqtt.js").then(({ listenMqtt, stopListen }) => {
                client = listenMqtt(ctx, (err, event) => {
                    if (err) return callback(err, null);
                    callback(null, event);
                });
            });
            const handle = {
                stopListening(cb) {
                    import("./mqtt.js").then(({ stopListen }) => {
                        stopListen(ctx);
                        if (cb) cb();
                    });
                },
                async stopListeningAsync() {
                    const { stopListen } = await import("./mqtt.js");
                    stopListen(ctx);
                },
            };
            return handle;
        },

        sendMessage(msg, threadID, callback, replyToMessageID) {
            const p = (async () => {
                await humanDelay();
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
                const otid = Date.now().toString() + Math.floor(Math.random() * 1000000).toString();
                const form = withDtsg({
                    client: "mercury",
                    action_type: "ma-type:user-generated-message",
                    author: "fbid:" + ctx.userID,
                    timestamp: Date.now(),
                    timestamp_absolute: "Today",
                    timestamp_time_passed: "0",
                    is_unread: false,
                    is_cleared: false,
                    is_forward: false,
                    is_filtered_content: false,
                    is_spoof_warning: false,
                    source: "source:chat:web",
                    "source_tags[0]": "source:chat",
                    body,
                    html_body: false,
                    ui_push_phase: "V3",
                    status: "0",
                    offline_threading_id: otid,
                    message_id: otid,
                    threading_id: otid,
                    "ephemeral_ttl_mode:": "0",
                    manual_retry_cnt: "0",
                    has_attachment: attachmentIds.length > 0,
                    message_text: body,
                }, ctx.userID);
                const tid = String(threadID);
                if (tid.length === 15 || tid === String(ctx.userID)) {
                    form["specific_to_list[0]"] = "fbid:" + tid;
                    form["specific_to_list[1]"] = "fbid:" + ctx.userID;
                    form["other_user_fbid"] = tid;
                } else {
                    form["thread_fbid"] = tid;
                }
                if (replyToMessageID) form.replied_to_message_id = replyToMessageID;
                attachmentIds.forEach((a, i) => {
                    form[`attachment[${i}][id]`] = a.id || a;
                });
                const res = await post("https://www.facebook.com/messaging/send/", headers, withDtsg(form, ctx.userID));
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
                const res = await post("https://www.facebook.com/messaging/set_message_reaction/", headers, withDtsg(form, ctx.userID));
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

        unsendMessage(messageID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/unsend_message/", headers, withDtsg({
                    message_id: messageID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getUserInfo(userIDs, callback) {
            const p = (async () => {
                const ids = Array.isArray(userIDs) ? userIDs : [userIDs];
                const form = {};
                ids.forEach((id, i) => (form[`ids[${i}]`] = id));
                const res = await post("https://www.facebook.com/chat/user_info/", headers, withDtsg(form, ctx.userID));
                parseRes(res);
                return res.payload?.profiles || {};
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getUserID(name, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/api/graphqlbatch/", headers, withDtsg({
                    q: `node(${name}){id,name}`,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getThreadList(limit, timestamp, tags, callback) {
            const p = (async () => {
                const form = {
                    limit: limit || 20,
                    tags: tags || ["INBOX"],
                };
                if (timestamp) form.timestamp = timestamp;
                const res = await post("https://www.facebook.com/api/graphqlbatch/", headers, withDtsg(form, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getThreadInfo(threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/api/graphqlbatch/", headers, withDtsg({
                    q: `node(${threadID}){name,participants{id,name}}`,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        addUserToGroup(userIDs, threadID, callback) {
            const p = (async () => {
                const ids = Array.isArray(userIDs) ? userIDs : [userIDs];
                const form = { thread_fbid: threadID };
                ids.forEach((id, i) => (form[`added_ids[${i}]`] = id));
                const res = await post("https://www.facebook.com/messaging/send/", headers, withDtsg(form, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        removeUserFromGroup(userID, threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/chat/remove_participants", headers, withDtsg({
                    tid: threadID,
                    ids: userID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        setTitle(title, threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/set_thread_name/", headers, withDtsg({
                    thread_name: title,
                    thread_id: threadID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        deleteThread(threadIDs, callback) {
            const p = (async () => {
                const ids = Array.isArray(threadIDs) ? threadIDs : [threadIDs];
                const form = {};
                ids.forEach((id, i) => (form[`ids[${i}]`] = id));
                const res = await post("https://www.facebook.com/messaging/delete_thread/", headers, withDtsg(form, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        editMessage(messageID, newBody, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/edit_message/", headers, withDtsg({
                    message_id: messageID,
                    message_text: newBody,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeThreadEmoji(emoji, threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/save_thread_emoji/", headers, withDtsg({
                    emoji,
                    thread_or_other_fbid: threadID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeThreadColor(color, threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/save_thread_color/", headers, withDtsg({
                    color,
                    thread_or_other_fbid: threadID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeGroupImage(imageStream, threadID, callback) {
            const p = (async () => {
                const chunks = [];
                for await (const c of imageStream) chunks.push(c);
                const buf = Buffer.concat(chunks);
                const res = await postFormData(
                    "https://www.facebook.com/messaging/set_thread_image/",
                    headers,
                    { thread_id: threadID },
                    { image: buf }
                );
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeBio(bio, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/api/graphql/", headers, withDtsg({
                    q: `bio:${bio}`,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeAdminStatus(threadID, userID, isAdmin, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/save_admins/", headers, withDtsg({
                    thread_fbid: threadID,
                    admin_ids: isAdmin ? userID : "",
                    remove_admin_ids: isAdmin ? "" : userID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        sendTypingIndicator(threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/messaging/typ/", headers, withDtsg({
                    thread: threadID,
                    typ: 1,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getFriendsList(callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/api/graphqlbatch/", headers, withDtsg({
                    q: "friends",
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getAppState() {
            return ctx.appstate;
        },

        httpPost(url, form, callback) {
            const p = post(url, headers, withDtsg(form, ctx.userID)).then(parseRes);
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        listen(callback) {
            return this.listenMqtt(callback);
        },

        setOptions(options) {
            Object.assign(ctx.options, options || {});
        },

        markAsRead(threadID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/ajax/mercury/change_read_status.php", headers, withDtsg({
                    thread_ids: threadID,
                    action: "mark_read",
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        markAsDelivered(threadID, messageID, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/ajax/mercury/delivery_receipts.php", headers, withDtsg({
                    thread_id: threadID,
                    message_id: messageID,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        markAsReadAll(callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/ajax/mercury/mark_all_read.php", headers, withDtsg({}, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        getThreadHistory(threadID, amount, timestamp, callback) {
            const p = (async () => {
                const res = await post("https://www.facebook.com/api/graphqlbatch/", headers, withDtsg({
                    q: `thread(${threadID},${amount || 20}){messages}`,
                }, ctx.userID));
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        changeAvatar(imageStream, callback) {
            const p = (async () => {
                const chunks = [];
                for await (const c of imageStream) chunks.push(c);
                const buf = Buffer.concat(chunks);
                const res = await postFormData(
                    "https://www.facebook.com/profile/picture/upload/",
                    headers,
                    {},
                    { avatar: buf }
                );
                parseRes(res);
                return res;
            })();
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        async getFreshDtsg(callback) {
            const { fetchFbDtsg } = await import("./dtsg.js");
            const p = fetchFbDtsg(headers);
            if (callback) p.then((r) => callback(null, r)).catch((e) => callback(e));
            return p;
        },

        async refreshFb(callback) {
            return this.getFreshDtsg(callback);
        },
    };
}
