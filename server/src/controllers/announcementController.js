import Announcement from '../models/Announcement.js';

let cachedReleases = { at: 0, data: null };
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'Sebastian0211-vs/ISC-Steam';

/** GET /api/announcement - public: the current banner (or null). */
export async function getAnnouncement(req, res, next) {
  try {
    const a = await Announcement.findOne().sort({ updatedAt: -1 });
    if (!a || !a.active || !a.text) return res.json({ announcement: null });
    res.json({
      announcement: { id: a._id.toString(), text: a.text, link: a.link, updatedAt: a.updatedAt },
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /api/admin/announcement { text, link?, active } - admin only. */
export async function setAnnouncement(req, res, next) {
  try {
    const text = String(req.body.text ?? '').trim().slice(0, 500);
    const link = String(req.body.link ?? '').trim().slice(0, 500);
    const active = !!req.body.active && !!text;

    const a = (await Announcement.findOne().sort({ updatedAt: -1 })) ?? new Announcement();
    a.text = text;
    a.link = link;
    a.active = active;
    a.author = req.user._id;
    await a.save();
    res.json({ ok: true, active: a.active });
  } catch (err) {
    next(err);
  }
}

/** GET /api/releases - public: recent GitHub releases (cached 10 min). */
export async function listReleases(req, res, next) {
  try {
    if (!cachedReleases.data || Date.now() - cachedReleases.at > 10 * 60 * 1000) {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'isc-steam' },
      });
      if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
      const releases = await response.json();
      cachedReleases = {
        at: Date.now(),
        data: releases
          .filter((r) => !r.draft)
          .map((r) => ({
            tag: r.tag_name,
            name: r.name || r.tag_name,
            body: (r.body ?? '').slice(0, 4000),
            publishedAt: r.published_at,
            url: r.html_url,
          })),
      };
    }
    res.json({ releases: cachedReleases.data });
  } catch (err) {
    // fail soft: the bell just shows nothing
    if (cachedReleases.data) return res.json({ releases: cachedReleases.data });
    res.json({ releases: [] });
  }
}
