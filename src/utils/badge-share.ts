import { CertificateContent } from "../services/cms-certificate.service";
import { CmsModule } from "../services/cms-modules.service";

const joinText = (...parts: (string | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(" ");

/**
 * Ready-made posts for sharing one module badge on LinkedIn and X. They tag the
 * module's partner ("X Handles" / "LinkedIn Handles") and the cohort's own
 * handles. A module's "Share Text" replaces the wording, using {badge} {title}
 * {week} {partner} {handles} {link}.
 */
export function composeBadgeShare(
  badge: { name: string; week: number | null; moduleTitle: string | null },
  module: CmsModule | undefined,
  content: CertificateContent,
  link: string | null
) {
  const title = badge.moduleTitle ?? module?.title ?? "";
  const partner = module?.partner && module.partner !== "Si Her DeFi" ? module.partner : "";
  const handles = {
    x: joinText(module?.share.x, content.shareXHandles),
    linkedin: joinText(module?.share.linkedin, content.shareLinkedinHandles),
  };
  const compose = (platform: "x" | "linkedin") => {
    const custom = module?.share.text;
    if (custom) {
      const filled = custom
        .replace(/\{badge\}/gi, badge.name)
        .replace(/\{title\}/gi, title)
        .replace(/\{week\}/gi, badge.week ? String(badge.week) : "")
        .replace(/\{partner\}/gi, partner)
        .replace(/\{link\}/gi, link ?? "");
      return /\{handles\}/i.test(filled)
        ? filled.replace(/\{handles\}/gi, handles[platform])
        : joinText(filled, handles[platform], content.shareHashtags);
    }
    const what = `I just earned the "${badge.name}" badge in Si Her DeFi: ${title}${
      partner ? ` with ${partner}` : ""
    }! 🎉`;
    return platform === "x"
      ? joinText(what, handles.x, content.shareHashtags, link ?? undefined)
      : `${joinText(what, handles.linkedin)}\n\n${joinText(content.shareHashtags)}${link ? `\n${link}` : ""}`.trim();
  };
  return { x: compose("x"), linkedin: compose("linkedin") };
}
