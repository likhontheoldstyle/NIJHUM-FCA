# nijhum-fca

Minimal Facebook Chat API for Messenger bots. ESM only.

## Install

```bash
npm install nijhum-fca
```

## Usage

```js
import login from "nijhum-fca";
import { readFileSync } from "fs";

const appState = JSON.parse(readFileSync("./appstate.json", "utf8"));

login({ appState }, {
    userAgent: "Mozilla/5.0 ...",
    online: true,
}, (err, api) => {
    if (err) throw err;
    console.log("Logged in as " + api.getCurrentUserID());
    api.listenMqtt((err, event) => {
        if (err) return console.error(err);
        if (!event) return;
        console.log(event);
    });
});
```

## Anti-Detection Features

- **BypassAutomationBehavior** (default on) — human-like request timing, jittered MQTT keepalive, browser-like headers. Reduces ban risk. Disable with `bypassAutomationBehavior: false` in login options.
- **AutoRefreshFbDtsg** (default on) — automatically refreshes the fb_dtsg token hourly to keep the session alive. Disable with `autoRefreshFbDtsg: false`.

```js
login({ appState }, {
    bypassAutomationBehavior: true,  // default true
    autoRefreshFbDtsg: true,         // default true
}, callback);
```

## API

### Core
- `login({ appState }, options, callback)` — login with Facebook appstate
- `api.getCurrentUserID()` — returns the logged-in user ID
- `api.listenMqtt(callback)` — listen for real-time events (messages, etc.)
- `api.getAppState()` — returns the appstate

### Messaging
- `api.sendMessage(msg, threadID, callback, replyToMessageID)` — send text or attachment
- `api.unsendMessage(messageID, callback)` — unsend a message
- `api.editMessage(messageID, newBody, callback)` — edit a message
- `api.setMessageReaction(emoji, messageID, callback)` — react to a message
- `api.sendTypingIndicator(threadID, callback)` — show typing indicator

### Threads & Groups
- `api.getThreadList(limit, timestamp, tags, callback)` — list threads
- `api.getThreadInfo(threadID, callback)` — get thread info
- `api.deleteThread(threadIDs, callback)` — delete threads
- `api.setTitle(title, threadID, callback)` — set group name
- `api.addUserToGroup(userIDs, threadID, callback)` — add users to group
- `api.removeUserFromGroup(userID, threadID, callback)` — remove user from group
- `api.changeNickname(nickname, threadID, participantID, callback)` — change nickname
- `api.changeThreadEmoji(emoji, threadID, callback)` — change thread emoji
- `api.changeThreadColor(color, threadID, callback)` — change thread color
- `api.changeGroupImage(imageStream, threadID, callback)` — change group image
- `api.changeAdminStatus(threadID, userID, isAdmin, callback)` — change admin status

### Users
- `api.getUserInfo(userIDs, callback)` — get user info
- `api.getUserID(name, callback)` — search user by name
- `api.getFriendsList(callback)` — get friends list
- `api.changeBio(bio, callback)` — change bio

### Utility
- `api.httpPost(url, form, callback)` — raw POST with session

## Events

- `{ type: "message", threadID, messageID, senderID, body, timestamp }`
- `{ type: "message_reply", ... }` — reply to a message
- `{ type: "event", logMessageType: "log:subscribe", ... }` — group join/leave events
