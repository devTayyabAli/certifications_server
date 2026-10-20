import { CertificateContent } from "../services/cms-certificate.service";
import { CmsModule } from "../services/cms-modules.service";
import { CmsSpeaker } from "../services/cms-speaker.service";

export interface ShareHandle {
  /** e.g. "SI<3> LinkedIn", "Kara Howard X" */
  label: string;
  platform: "x" | "linkedin";
  /** what the learner copies: "@si3_ecosystem", or a profile link */
  handle: string;
  /** the profile, when it can be worked out */
  url: string | null;
}

export interface BadgeShare {
  /** sample post for the learner to customise; no handles or links in it */
  text: string;
  /** who to tag, in CMS order: company LinkedIn, speaker LinkedIn, company X, speaker X. Only the ones set. */
  handles: ShareHandle[];
  /** the session image to post with (CMS Share Image, else the banner or thumbnail) */
  image: string | null;
}

const COMPANY = "SI<3>";

/** "@si3_ecosystem", "si3_ecosystem" or "https://x.com/si3_ecosystem" → "@si3_ecosystem" + profile url */
function xHandle(value: string): { handle: string; url: string | null } | null {
  const v = value.trim();
  if (!v) return null;
  const fromUrl = v.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i)?.[1];
  const name = fromUrl ?? v.replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(name)) return { handle: v, url: /^https?:\/\//i.test(v) ? v : null };
  return { handle: `@${name}`, url: `https://x.com/${name}` };
}

/** "si3-ecosystem", "in/kara" or a full LinkedIn URL → what to copy + profile url */
function linkedinHandle(value: string): { handle: string; url: string | null } | null {
  const v = value.trim().replace(/^@/, "");
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return { handle: v, url: v };
  const path = v.match(/^((?:in|company|school)\/[^/\s]+)/i)?.[1];
  if (path) return { handle: `linkedin.com/${path}`, url: `https://www.linkedin.com/${path}` };
  // a bare slug: could be a person or a company, so just the name to search for
  return { handle: v, url: null };
}

/** Several handles in one field ("@a, @b") → each on its own */
const split = (value: string | undefined) =>
  (value ?? "")
    .split(/[,\n;]+|\s+(?=@)/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * What a learner needs to share one module badge: a sample post, the handles
 * to tag (the company's from the module / certificate settings, the speaker's
 * from the module's Speaker fields or their speaker card), and the session
 * image. A module's "Share Text" replaces the wording, using {badge} {title}
 * {week} {partner}; {handles} and {link} are dropped (handles are listed
 * separately now).
 */
export function composeBadgeShare(
  badge: { name: string; week: number | null; moduleTitle: string | null },
  module: CmsModule | undefined,
  content: CertificateContent,
  speakers: Pick<CmsSpeaker, "name" | "links">[] = []
): BadgeShare {
  const title = badge.moduleTitle ?? module?.title ?? "";
  const partner = module?.partner && module.partner !== "Si Her DeFi" ? module.partner : "";

  const custom = module?.share.text;
  const text = custom
    ? custom
        .replace(/\{badge\}/gi, badge.name)
        .replace(/\{title\}/gi, title)
        .replace(/\{week\}/gi, badge.week ? String(badge.week) : "")
        .replace(/\{partner\}/gi, partner)
        .replace(/\{(handles|link|hashtags)\}/gi, "")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : [
        `I just earned the "${badge.name}" badge in Si Her DeFi: ${title}${partner ? ` with ${partner}` : ""}! 🎉`,
        content.shareHashtags?.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

  const companyName = partner || COMPANY;
  // the Nth handle in a module's Speaker field belongs to the Nth speaker
  const speakerName = (i: number) => speakers[i]?.name?.trim() || "Speaker";

  const companyLinkedin = split(module?.share.linkedin).length ? split(module?.share.linkedin) : split(content.shareLinkedinHandles);
  const companyX = split(module?.share.x).length ? split(module?.share.x) : split(content.shareXHandles);
  // the module's Speaker fields win; otherwise each speaker card's own links
  const speakerLinkedin = split(module?.share.speakerLinkedin).length
    ? split(module?.share.speakerLinkedin).map((h, i) => ({ name: speakerName(i), value: h }))
    : speakers.filter((s) => s.links?.linkedin).map((s) => ({ name: s.name, value: s.links.linkedin! }));
  const speakerX = split(module?.share.speakerX).length
    ? split(module?.share.speakerX).map((h, i) => ({ name: speakerName(i), value: h }))
    : speakers.filter((s) => s.links?.x).map((s) => ({ name: s.name, value: s.links.x! }));

  const handles: ShareHandle[] = [];
  for (const v of companyLinkedin) {
    const h = linkedinHandle(v);
    if (h) handles.push({ label: `${companyName} LinkedIn`, platform: "linkedin", ...h });
  }
  for (const s of speakerLinkedin) {
    const h = linkedinHandle(s.value);
    if (h) handles.push({ label: `${s.name} LinkedIn`, platform: "linkedin", ...h });
  }
  for (const v of companyX) {
    const h = xHandle(v);
    if (h) handles.push({ label: `${companyName} X`, platform: "x", ...h });
  }
  for (const s of speakerX) {
    const h = xHandle(s.value);
    if (h) handles.push({ label: `${s.name} X`, platform: "x", ...h });
  }

  const image = module?.share.image ?? module?.bannerUrl ?? module?.thumbnailUrl ?? null;
  return { text, handles, image };
}
