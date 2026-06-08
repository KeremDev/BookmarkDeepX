(function initBookmarkDeepXPageBridge() {
  if (window.__bookmarkDeepXBridgeInstalled) return;
  window.__bookmarkDeepXBridgeInstalled = true;

  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  let deleteTemplate = null;
  let bookmarkTimelineTemplate = null;

  window.fetch = async function bookmarkDeepXFetch(input, init = {}) {
    const requestUrl = getRequestUrl(input);
    const requestBody = readRequestBody(input, init);
    const requestHeaders = readRequestHeaders(input, init);
    const response = await originalFetch.apply(this, arguments);
    inspectRequestTemplate(requestUrl, init?.method || input?.method || "GET", requestBody, requestHeaders);
    inspectBookmarkTemplate(requestUrl, init?.method || input?.method || "GET", requestBody, requestHeaders);
    inspectResponse(requestUrl, response.clone());
    return response;
  };

  XMLHttpRequest.prototype.open = function bookmarkDeepXOpen(method, url) {
    this.__bdxMethod = method;
    this.__bdxUrl = String(url || "");
    this.__bdxHeaders = {};
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function bookmarkDeepXSetRequestHeader(name, value) {
    this.__bdxHeaders = this.__bdxHeaders || {};
    this.__bdxHeaders[name] = value;
    return originalSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function bookmarkDeepXSend(body) {
    inspectRequestTemplate(this.__bdxUrl, this.__bdxMethod || "GET", body, this.__bdxHeaders || {});
    inspectBookmarkTemplate(this.__bdxUrl, this.__bdxMethod || "GET", body, this.__bdxHeaders || {});
    this.addEventListener("load", () => {
      if (!looksLikeBookmarkUrl(this.__bdxUrl)) return;
      try {
        postCapture(JSON.parse(this.responseText), this.__bdxUrl);
      } catch {
        // Ignore non-JSON responses.
      }
    });
    return originalSend.apply(this, arguments);
  };

  window.addEventListener("message", async (event) => {
    if (event.source !== window || event.data?.source !== "BookmarkDeepX:content") return;

    if (event.data.type === "BDX_PAGE_REMOVE_BOOKMARK") {
      const result = await removeBookmarkWithTemplate(event.data.tweetId);
      postPageResult("BDX_PAGE_REMOVE_RESULT", event.data.requestId, result);
    }

    if (event.data.type === "BDX_PAGE_SYNC_BOOKMARKS") {
      const result = await syncBookmarksWithTemplate(event.data.options || {});
      postPageResult("BDX_PAGE_SYNC_RESULT", event.data.requestId, result);
    }
  });

  function inspectResponse(url, response) {
    if (!looksLikeBookmarkUrl(url)) return;
    response
      .json()
      .then((payload) => postCapture(payload, url))
      .catch(() => {});
  }

  function inspectRequestTemplate(url, method, body, headers = {}) {
    if (!url || !String(url).includes("/i/api/graphql/")) return;
    const bodyText = stringifyBody(body);
    if (!String(url).includes("DeleteBookmark") && !bodyText.includes("DeleteBookmark")) return;
    deleteTemplate = {
      url: String(url),
      method: method || "POST",
      headers,
      body: bodyText,
    };
    postDeleteTemplate(deleteTemplate);
  }

  function inspectBookmarkTemplate(url, method, body, headers = {}) {
    if (!looksLikeBookmarkUrl(url) || !String(url).includes("/i/api/graphql/")) return;
    const bodyText = stringifyBody(body);
    if (String(url).includes("DeleteBookmark") || bodyText.includes("DeleteBookmark")) return;

    bookmarkTimelineTemplate = {
      url: String(url),
      method: method || "GET",
      headers,
      body: bodyText,
    };
    postTemplate(bookmarkTimelineTemplate);
  }

  async function removeBookmarkWithTemplate(tweetId) {
    if (!deleteTemplate) return { ok: false, error: "DeleteBookmark template yok" };

    try {
      const body = rewriteDeleteBookmarkBody(deleteTemplate.body, tweetId);
      const response = await originalFetch(deleteTemplate.url, {
        method: deleteTemplate.method || "POST",
        credentials: "include",
        headers: {
          ...(deleteTemplate.headers || {}),
          "content-type": "application/json",
        },
        body,
      });
      return { ok: response.ok, status: response.status, method: "graphql-template" };
    } catch (error) {
      return { ok: false, error: error.message || "Template ile silme başarısız" };
    }
  }

  function rewriteDeleteBookmarkBody(bodyText, tweetId) {
    const parsed = JSON.parse(bodyText || "{}");
    parsed.variables = parsed.variables || {};
    for (const key of ["tweet_id", "tweetId", "id", "tweetID"]) {
      if (key in parsed.variables) parsed.variables[key] = tweetId;
    }
    if (!("tweet_id" in parsed.variables) && !("tweetId" in parsed.variables)) {
      parsed.variables.tweet_id = tweetId;
    }
    return JSON.stringify(parsed);
  }

  async function syncBookmarksWithTemplate(options = {}) {
    if (!bookmarkTimelineTemplate) {
      return { ok: false, error: "Bookmark timeline request template yok" };
    }

    const seenCursors = new Set();
    let cursor = null;
    let pages = 0;
    const maxPages = Math.min(Math.max(Number(options.maxPages) || 240, 1), 500);

    for (let index = 0; index < maxPages; index += 1) {
      const request = buildBookmarkRequest(bookmarkTimelineTemplate, cursor);
      const response = await originalFetch(request.url, {
        method: request.method,
        credentials: "include",
        headers: {
          ...(bookmarkTimelineTemplate.headers || {}),
          ...(request.body ? { "content-type": "application/json" } : {}),
        },
        body: request.body,
      });

      if (!response.ok) {
        return { ok: false, status: response.status, pages, error: `Bookmark request ${response.status}` };
      }

      const payload = await response.json();
      pages += 1;
      postCapture(payload, request.url);

      const nextCursor = extractBottomCursor(payload);
      if (!nextCursor || seenCursors.has(nextCursor)) {
        return { ok: true, pages, done: true };
      }

      seenCursors.add(nextCursor);
      cursor = nextCursor;
      await delay(Number(options.delayMs) || 550);
    }

    return { ok: true, pages, capped: true };
  }

  function buildBookmarkRequest(template, cursor) {
    const method = String(template.method || "GET").toUpperCase();
    const url = new URL(template.url, location.origin);
    let body = template.body || "";

    if (url.searchParams.has("variables")) {
      const variables = parseJsonParam(url.searchParams.get("variables")) || {};
      if (cursor) variables.cursor = cursor;
      url.searchParams.set("variables", JSON.stringify(variables));
    } else if (body) {
      const parsed = JSON.parse(body || "{}");
      parsed.variables = parsed.variables || {};
      if (cursor) parsed.variables.cursor = cursor;
      body = JSON.stringify(parsed);
    }

    return {
      url: url.toString(),
      method,
      body: method === "GET" ? undefined : body,
    };
  }

  function extractBottomCursor(payload) {
    let cursor = null;
    walk(payload, (node) => {
      if (cursor || !node || typeof node !== "object") return;
      const type = node.cursorType || node.cursor_type || node.type;
      if (String(type || "").toLowerCase() === "bottom") {
        cursor = node.value || node.cursor || null;
      }
    });
    return cursor;
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

  function parseJsonParam(value) {
    try {
      return JSON.parse(value || "{}");
    } catch {
      return null;
    }
  }

  function postPageResult(type, requestId, result) {
    window.postMessage(
      {
        source: "BookmarkDeepX:page",
        type,
        requestId,
        result,
      },
      window.location.origin,
    );
  }

  function postCapture(payload, url) {
    window.postMessage(
      {
        source: "BookmarkDeepX:page",
        type: "BDX_X_CAPTURE",
        payload,
        url,
        capturedAt: new Date().toISOString(),
      },
      window.location.origin,
    );
  }

  function postTemplate(template) {
    window.postMessage(
      {
        source: "BookmarkDeepX:page",
        type: "BDX_X_TEMPLATE",
        template,
        capturedAt: new Date().toISOString(),
      },
      window.location.origin,
    );
  }

  function postDeleteTemplate(template) {
    window.postMessage(
      {
        source: "BookmarkDeepX:page",
        type: "BDX_X_DELETE_TEMPLATE",
        template,
        capturedAt: new Date().toISOString(),
      },
      window.location.origin,
    );
  }

  function looksLikeBookmarkUrl(url) {
    const value = String(url || "");
    return (
      value.includes("BookmarkTimeline") ||
      value.includes("bookmark_timeline") ||
      value.includes("bookmark_timeline_v2") ||
      value.includes("Bookmarks") ||
      value.includes("/i/bookmarks")
    );
  }

  function getRequestUrl(input) {
    if (typeof input === "string") return input;
    return input?.url || "";
  }

  function readRequestBody(input, init) {
    return init?.body || input?.body || "";
  }

  function readRequestHeaders(input, init) {
    return cloneHeaders(init?.headers || input?.headers);
  }

  function cloneHeaders(headers) {
    if (!headers) return {};
    const cloned = {};
    try {
      new Headers(headers).forEach((value, key) => {
        if (!["content-length", "host"].includes(key.toLowerCase())) {
          cloned[key] = value;
        }
      });
    } catch {
      return {};
    }
    return cloned;
  }

  function stringifyBody(body) {
    if (!body) return "";
    if (typeof body === "string") return body;
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
