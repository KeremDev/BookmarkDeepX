import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../public/x-parser.js", import.meta.url), "utf8");
const sandbox = {
  Intl,
  console,
  self: {},
};

vm.runInNewContext(source, sandbox, { filename: "x-parser.js" });

const fixture = {
  data: {
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            entries: [
              {
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: "1800000000000000001",
                        core: {
                          user_results: {
                            result: {
                              legacy: {
                                name: "Kerem",
                                screen_name: "keremux",
                                profile_image_url_https: "https://pbs.twimg.com/profile_images/example.jpg",
                              },
                            },
                          },
                        },
                        legacy: {
                          id_str: "1800000000000000001",
                          full_text: "Premium bookmark cards need clean actions. https://t.co/abc123",
                          created_at: "Sun Jun 07 10:00:00 +0000 2026",
                          reply_count: 7,
                          retweet_count: 13,
                          favorite_count: 144,
                          extended_entities: {
                            media: [
                              {
                                type: "photo",
                                media_url_https: "https://pbs.twimg.com/media/example.jpg",
                                ext_alt_text: "Bookmark card reference",
                                original_info: { width: 1200, height: 800 },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                content: {
                  cursorType: "Bottom",
                  value: "cursor-bottom-1",
                },
              },
            ],
          },
        ],
      },
    },
  },
};

const parsed = sandbox.self.BookmarkDeepXParser.parseBookmarkPayload(fixture, {
  capturedAt: "2026-06-08T09:00:00.000Z",
});

assert.equal(parsed.bookmarks.length, 1);
assert.equal(parsed.cursor, "cursor-bottom-1");

const [bookmark] = parsed.bookmarks;
assert.equal(bookmark.tweetId, "1800000000000000001");
assert.equal(bookmark.author, "Kerem");
assert.equal(bookmark.handle, "@keremux");
assert.equal(bookmark.type, "image");
assert.equal(bookmark.text, "Premium bookmark cards need clean actions.");
assert.equal(bookmark.media.src, "https://pbs.twimg.com/media/example.jpg");
assert.equal(bookmark.metrics.reply, 7);
assert.equal(bookmark.metrics.repost, 13);
assert.equal(bookmark.metrics.like, 144);
assert.equal(bookmark.syncState, "synced");

const detachedUserFixture = {
  data: {
    globalObjects: {
      users: {
        "4242": {
          id_str: "4242",
          name: "Ayse Product",
          screen_name: "ayseproduct",
          profile_image_url_https: "https://pbs.twimg.com/profile_images/ayse.jpg",
        },
      },
    },
    bookmark_timeline_v2: {
      timeline: {
        instructions: [
          {
            entries: [
              {
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        rest_id: "1800000000000000002",
                        legacy: {
                          id_str: "1800000000000000002",
                          user_id_str: "4242",
                          full_text: "User can be detached from the tweet node.",
                          created_at: "Sun Jun 07 11:00:00 +0000 2026",
                          reply_count: 1,
                          retweet_count: 2,
                          favorite_count: 3,
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    },
  },
};

const detachedParsed = sandbox.self.BookmarkDeepXParser.parseBookmarkPayload(detachedUserFixture, {
  capturedAt: "2026-06-08T09:00:00.000Z",
});

assert.equal(detachedParsed.bookmarks.length, 1);
assert.equal(detachedParsed.bookmarks[0].author, "Ayse Product");
assert.equal(detachedParsed.bookmarks[0].handle, "@ayseproduct");
assert.equal(detachedParsed.bookmarks[0].avatar, "https://pbs.twimg.com/profile_images/ayse.jpg");

const duplicateUnknownFirstFixture = {
  data: {
    entries: [
      {
        legacy: {
          id_str: "1800000000000000003",
          full_text: "Same tweet can appear first without user.",
          created_at: "Sun Jun 07 12:00:00 +0000 2026",
        },
      },
      {
        tweet_results: {
          result: {
            rest_id: "1800000000000000003",
            core: {
              user_results: {
                result: {
                  legacy: {
                    name: "Known Later",
                    screen_name: "knownlater",
                  },
                },
              },
            },
            legacy: {
              id_str: "1800000000000000003",
              full_text: "Same tweet can appear first without user.",
              created_at: "Sun Jun 07 12:00:00 +0000 2026",
            },
          },
        },
      },
    ],
  },
};

const duplicateParsed = sandbox.self.BookmarkDeepXParser.parseBookmarkPayload(duplicateUnknownFirstFixture, {
  capturedAt: "2026-06-08T09:00:00.000Z",
});

assert.equal(duplicateParsed.bookmarks.length, 1);
assert.equal(duplicateParsed.bookmarks[0].author, "Known Later");
assert.equal(duplicateParsed.bookmarks[0].handle, "@knownlater");

console.log("Parser fixture OK");
