const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const username = String(req.query.username || "").trim().replace(/^@/, "");
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: "Enter a valid Instagram username." });

  const apiKey = process.env.SOCIALFETCH_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Public profile API is not configured yet. Add SOCIALFETCH_API_KEY in Vercel Environment Variables." });

  try {
    const response = await fetch(`https://api.socialfetch.dev/v2/instagram/profiles/${encodeURIComponent(username)}`, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(25000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 401 ? "Provider API key is invalid."
        : response.status === 402 ? "Provider credits are exhausted."
        : response.status === 404 ? "Username was not found or is unavailable."
        : response.status === 429 ? "Too many requests. Try again later."
        : `Profile provider error (${response.status}).`;
      return res.status(response.status === 404 ? 404 : 502).json({ error: message });
    }
    const p = result.data?.profile || result.profile || result.data;
    if (!p || typeof p !== "object") return res.status(404).json({ error: "No public profile data was returned." });
    const metrics = p.metrics || {};
    return res.status(200).json({ profile: {
      handle: p.handle || p.username || username,
      displayName: p.displayName || p.fullName || p.full_name || null,
      bio: p.bio || p.biography || null,
      avatarUrl: p.avatarUrl || p.profilePicUrl || p.profile_pic_url || p.profilePicture || null,
      verified: Boolean(p.verified || p.is_verified),
      followers: metrics.followers ?? p.followers ?? p.followersCount ?? p.followers_count ?? null,
      following: metrics.following ?? p.following ?? p.followingCount ?? p.following_count ?? null,
      posts: metrics.posts ?? p.posts ?? p.postsCount ?? p.media_count ?? null
    }});
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the public profile provider. Please retry." });
  }
};
