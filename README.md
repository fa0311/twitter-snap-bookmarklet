# twitter-snap-bookmarklet

```s
pnpm i
```

```.env
LINE_PUSH_TOKEN=""
LINE_PUSH_BASE_URL=""
WEBDAV_URL=""
WEBDAV_USERNAME=""
WEBDAV_PASSWORD=""
WEBDAV_SHARE_BASE_URL=""
WEBDAV_BASE_PATH=""
TWITTER_SNAP_API_BASEURL="http://twitter-snap-api:3000"
```

## Bookmarklet

```javascript
javascript: (function () {
  const url = window.location.href;
  const twitterRegex =
    /^https:\/\/(twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/;
  const match = url.match(twitterRegex);

  if (match) {
    const tweetId = match[2];
    const newUrl = `https://example.com/api/snap/2024/${tweetId}`;
    window.open(newUrl, "_blank");
  } else {
    alert("Error: The current page is not an individual Twitter tweet page.");
  }
})();
```
