(function initBookmarkDeepXParser(globalScope) {
  function parseBookmarkPayload(payload, meta = {}) {
    const bookmarkMap = new Map();
    const userLookup = collectUsers(payload);
    let cursor = null;

    walk(payload, (node) => {
      const cursorValue = readCursor(node);
      if (cursorValue) cursor = cursorValue;

      const tweet = normalizeTweetNode(node, meta, userLookup);
      if (!tweet) return;
      bookmarkMap.set(tweet.tweetId, mergeParsedTweet(bookmarkMap.get(tweet.tweetId), tweet));
    });

    return { bookmarks: [...bookmarkMap.values()], cursor };
  }

  function mergeParsedTweet(existing, incoming) {
    if (!existing) return incoming;
    if (!hasKnownUser(existing) && hasKnownUser(incoming)) return { ...existing, ...incoming };
    if (hasKnownUser(existing) && !hasKnownUser(incoming)) {
      return {
        ...incoming,
        author: existing.author,
        handle: existing.handle,
        avatar: existing.avatar,
        url: existing.url,
      };
    }
    return { ...existing, ...incoming };
  }

  function hasKnownUser(bookmark) {
    return Boolean(
      bookmark?.author &&
        bookmark?.handle &&
        bookmark.author !== "unknown" &&
        bookmark.handle !== "@unknown",
    );
  }

  function walk(value, visit) {
    if (!value || typeof value !== "object") return;
    visit(value);

    if (Array.isArray(value)) {
      for (const item of value) walk(item, visit);
      return;
    }

    for (const item of Object.values(value)) {
      if (item && typeof item === "object") walk(item, visit);
    }
  }

  function readCursor(node) {
    if (!node || typeof node !== "object") return null;
    const type = node.cursorType || node.cursor_type || node.type;
    if (String(type || "").toLowerCase() !== "bottom") return null;
    return node.value || node.cursor || null;
  }

  function collectUsers(payload) {
    const byId = new Map();
    const byHandle = new Map();

    walk(payload, (node) => {
      const user = normalizeUserNode(node);
      if (!user) return;

      for (const id of user.ids) {
        if (id) byId.set(String(id), user);
      }

      if (user.handle) {
        byHandle.set(user.handle.replace(/^@/, "").toLowerCase(), user);
      }
    });

    return { byId, byHandle };
  }

  function normalizeTweetNode(node, meta, userLookup) {
    const result = unwrapTweetResult(node);
    if (!result) return null;

    const legacy = result.legacy || result.tweet?.legacy || node.legacy;
    const tweetId = legacy?.id_str || result.rest_id || result.id_str || node.rest_id;
    const text =
      result.note_tweet?.note_tweet_results?.result?.text ||
      result.note_tweet?.note_tweet_results?.result?.text_with_entities?.text ||
      legacy?.full_text ||
      legacy?.text;

    if (!tweetId || !text) return null;

    const user = resolveTweetUser(result, legacy, node, userLookup);
    const handle = user?.handle || "@unknown";
    const author = user?.name || handle.replace("@", "") || "unknown";
    const media = extractMedia(legacy);
    const type = media?.kind === "video" ? "video" : media ? "image" : "text";
    const createdAt = normalizeDate(legacy?.created_at) || meta.capturedAt || new Date().toISOString();

    return {
      id: tweetId,
      tweetId,
      author,
      handle,
      avatar: user?.avatar || "",
      date: formatRelativeDate(createdAt),
      createdAt,
      type,
      title: "",
      localTitle: "",
      text: cleanTweetText(text),
      tags: [],
      folder: "",
      localFolder: "",
      task: { title: "", done: false, due: "" },
      media: media
        ? {
            src: media.url,
            alt: media.alt || "X media",
            shape: media.shape,
            kind: media.kind,
          }
        : null,
      metrics: {
        reply: legacy?.reply_count || 0,
        repost: legacy?.retweet_count || 0,
        like: legacy?.favorite_count || 0,
      },
      popularity: legacy?.favorite_count || 0,
      url: `https://x.com/${handle.replace("@", "")}/status/${tweetId}`,
      syncState: "synced",
      lastSeenAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };
  }

  function unwrapTweetResult(node) {
    if (!node || typeof node !== "object") return null;
    const candidates = [
      node,
      node.result,
      node.tweet,
      node.tweet?.result,
      node.tweet_results?.result,
      node.item?.itemContent?.tweet_results?.result,
      node.content?.itemContent?.tweet_results?.result,
    ];

    for (const candidate of candidates) {
      const unwrapped = unwrapTypename(candidate);
      if (unwrapped?.legacy && (unwrapped.rest_id || unwrapped.legacy?.id_str)) return unwrapped;
      if ((unwrapped?.full_text || unwrapped?.text) && unwrapped?.id_str) {
        return {
          ...unwrapped,
          rest_id: unwrapped.id_str,
          legacy: unwrapped,
        };
      }
    }

    return null;
  }

  function unwrapTypename(value) {
    if (!value || typeof value !== "object") return value;
    if (value.__typename === "TweetWithVisibilityResults") return value.tweet;
    if (value.tweet?.legacy) return value.tweet;
    return value;
  }

  function resolveTweetUser(result, legacy, node, userLookup) {
    const direct =
      normalizeUserNode(result.core?.user_results?.result) ||
      normalizeUserNode(result.user_results?.result) ||
      normalizeUserNode(result.user) ||
      normalizeUserNode(result.core?.user) ||
      normalizeUserNode(node.user) ||
      normalizeUserNode(node.user_results?.result);

    if (direct) return direct;

    const userIds = [
      legacy?.user_id_str,
      legacy?.user_id,
      result.user_id_str,
      result.user_id,
      result.core?.user_results?.result?.rest_id,
      result.user_results?.result?.rest_id,
      node.user_id_str,
      node.user_id,
    ].filter(Boolean);

    for (const id of userIds) {
      const user = userLookup.byId.get(String(id));
      if (user) return user;
    }

    return null;
  }

  function normalizeUserNode(node) {
    if (!node || typeof node !== "object") return null;

    const candidates = [
      node,
      node.result,
      node.user,
      node.user?.result,
      node.user_results?.result,
      node.core?.user_results?.result,
      node.content?.user_results?.result,
    ];

    for (const candidate of candidates) {
      const unwrapped = unwrapUserResult(candidate);
      if (!unwrapped || typeof unwrapped !== "object") continue;

      const legacy = unwrapped.legacy || unwrapped;
      const screenName = legacy.screen_name || legacy.screenName || unwrapped.screen_name;
      if (!screenName) continue;

      const ids = [
        unwrapped.rest_id,
        unwrapped.id_str,
        unwrapped.id,
        legacy.id_str,
        legacy.id,
      ].filter(Boolean);

      return {
        ids,
        name: legacy.name || unwrapped.name || screenName,
        handle: `@${String(screenName).replace(/^@/, "")}`,
        avatar: legacy.profile_image_url_https || legacy.profile_image_url || unwrapped.profile_image_url_https || "",
      };
    }

    return null;
  }

  function unwrapUserResult(value) {
    if (!value || typeof value !== "object") return null;
    if (value.__typename === "UserUnavailable") return null;
    if (value.__typename === "UserWithVisibilityResults" && value.user) return value.user;
    if (value.user?.legacy) return value.user;
    if (value.result?.result?.legacy) return value.result.result;
    if (value.result?.legacy) return value.result;
    return value;
  }

  function extractMedia(legacy) {
    const mediaItems = legacy?.extended_entities?.media || legacy?.entities?.media || [];
    const item = mediaItems[0];
    if (!item) return null;

    if (item.type === "video" || item.type === "animated_gif") {
      const variants = item.video_info?.variants || [];
      const mp4 = variants
        .filter((variant) => variant.content_type === "video/mp4" && variant.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      return {
        kind: "video",
        url: item.media_url_https || item.media_url || mp4?.url || "",
        alt: item.ext_alt_text || "",
        shape: mediaShape(item.original_info),
      };
    }

    return {
      kind: "image",
      url: item.media_url_https || item.media_url || "",
      alt: item.ext_alt_text || "",
      shape: mediaShape(item.original_info),
    };
  }

  function mediaShape(originalInfo) {
    if (!originalInfo?.width || !originalInfo?.height) return "landscape";
    return originalInfo.height > originalInfo.width * 1.12 ? "portrait" : "landscape";
  }

  function cleanTweetText(text) {
    return String(text).replace(/\s+https:\/\/t\.co\/\w+$/g, "").trim();
  }

  function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function formatRelativeDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(date);
  }

  globalScope.BookmarkDeepXParser = { parseBookmarkPayload };
})(typeof self !== "undefined" ? self : globalThis);
