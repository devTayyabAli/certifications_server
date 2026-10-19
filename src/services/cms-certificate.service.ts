import { CmsTableDef, readCmsTable, readSectionFieldKeys } from "./cms-table.service";

/**
 * Certificate wording, managed in the CMS on the Si Her DeFi (Base) page,
 * section "Certificate". Every field is optional — anything left empty falls
 * back to the defaults below, so the certificate always renders.
 */
export const CERTIFICATE_SECTION: CmsTableDef = {
  slug: "si-her-defi-certificate",
  name: "Si Her DeFi Certificate",
  description: "Wording on the learner certificate, its public verification page and LinkedIn.",
  page: { section: "Certificate" },
  fields: [
    // the certificate page's own heading, and the line under it (else "cohort · dates · program")
    { key: "pageTitle", columnId: "col-cert-page-title", name: "Page Title", type: "string" },
    { key: "pageSubtitle", columnId: "col-cert-page-subtitle", name: "Page Subtitle", type: "string" },
    // the certificate artwork (2000×2000, same layout as the built-in one); the name, badges
    // and on-chain details are drawn on top by the app
    {
      key: "certificateImage",
      columnId: "col-cert-image",
      name: "Certificate Image",
      type: "image",
      aliases: ["Certificate Background", "Background Image", "Certificate Design"],
    },
    { key: "programName", columnId: "col-cert-program", name: "Program Name", type: "string" },
    { key: "cohortLabel", columnId: "col-cert-cohort", name: "Cohort Label", type: "string" },
    { key: "cohortDates", columnId: "col-cert-dates", name: "Cohort Dates", type: "string" },
    { key: "statement", columnId: "col-cert-statement", name: "Statement", type: "text" },
    { key: "issuerName", columnId: "col-cert-issuer", name: "Issuer Name", type: "string" },
    { key: "issuerTagline", columnId: "col-cert-issuer-tag", name: "Issuer Tagline", type: "string" },
    { key: "presenterName", columnId: "col-cert-presenter", name: "Presenter Name", type: "string" },
    { key: "presenterTagline", columnId: "col-cert-presenter-tag", name: "Presenter Tagline", type: "string" },
    { key: "credentialName", columnId: "col-cert-credential", name: "Credential Name", type: "string" },
    { key: "linkedinOrganizationName", columnId: "col-cert-li-org", name: "LinkedIn Organization Name", type: "string" },
    { key: "linkedinOrganizationId", columnId: "col-cert-li-org-id", name: "LinkedIn Organization ID", type: "string" },
    { key: "shareText", columnId: "col-cert-share", name: "Share Text", type: "text" },
    // tagged in every badge post, after the module's own partner handles
    { key: "shareXHandles", columnId: "col-cert-share-x", name: "Share X Handles", type: "string" },
    { key: "shareLinkedinHandles", columnId: "col-cert-share-li", name: "Share LinkedIn Handles", type: "string" },
    { key: "shareHashtags", columnId: "col-cert-share-tags", name: "Share Hashtags", type: "string" },
  ],
};

export interface CertificateContent {
  pageTitle: string;
  /** empty = "cohort label · cohort dates · program name" */
  pageSubtitle: string;
  /** the certificate artwork from the CMS; null = the app's built-in design */
  certificateImage: string | null;
  programName: string;
  cohortLabel: string;
  cohortDates: string;
  statement: string;
  issuerName: string;
  issuerTagline: string;
  presenterName: string;
  presenterTagline: string;
  /** Name shown on LinkedIn "Licenses & certifications" */
  credentialName: string;
  linkedinOrganizationName: string;
  /** Numeric LinkedIn company id — shows the logo on the learner's profile */
  linkedinOrganizationId: string | null;
  shareText: string;
  shareXHandles: string;
  shareLinkedinHandles: string;
  shareHashtags: string;
  /** cohort label, dates and program name, in the order set in the CMS */
  detailsLine: string;
}

const DEFAULTS: CertificateContent = {
  pageTitle: "Your Achievements",
  pageSubtitle: "",
  certificateImage: null,
  programName: "Si Her DeFi",
  cohortLabel: "Cohort 01",
  cohortDates: "Sep 24 – Dec 3 2026",
  statement:
    "has completed the Si Her DeFi cohort and earned the module credentials listed below, verified on the Base network.",
  issuerName: "SI<3>",
  issuerTagline: "on-chain decentralised learning network",
  presenterName: "SI HER DAO",
  presenterTagline: "a women in Web3 collaborative",
  credentialName: "Si Her DeFi Certificate",
  linkedinOrganizationName: "SI<3>",
  linkedinOrganizationId: null,
  shareText: "I earned my Si Her DeFi certificate, verified on Base.",
  shareXHandles: "",
  shareLinkedinHandles: "",
  shareHashtags: "#SiHerDeFi",
  detailsLine: "Cohort 01 · Sep 24 – Dec 3 2026 · Si Her DeFi",
};

/** The line under the page title. Only these three follow the CMS field order. */
const DETAIL_KEYS = ["cohortLabel", "cohortDates", "programName"] as const;

function detailsLine(value: Pick<CertificateContent, (typeof DETAIL_KEYS)[number]>, order: string[] | null) {
  const ranked = (order ?? []).filter((key): key is (typeof DETAIL_KEYS)[number] =>
    (DETAIL_KEYS as readonly string[]).includes(key)
  );
  for (const key of DETAIL_KEYS) if (!ranked.includes(key)) ranked.push(key);
  return ranked.map((key) => value[key]?.trim()).filter(Boolean).join(" · ");
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; value: CertificateContent } | null = null;

export class CmsCertificateService {
  static async getContent(): Promise<CertificateContent> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    let value = DEFAULTS;
    try {
      const [rows, order] = await Promise.all([readCmsTable(CERTIFICATE_SECTION), readSectionFieldKeys(CERTIFICATE_SECTION)]);
      const v = rows?.[0]?.values ?? {};
      const pick = (key: keyof CertificateContent) => (v[key]?.trim() ? v[key].trim() : DEFAULTS[key]);
      // The section was saved as "Your On-Chain Certificate"; that heading is now Achievements.
      const pageTitle = pick("pageTitle") as string;
      value = {
        pageTitle: pageTitle === "Your On-Chain Certificate" ? DEFAULTS.pageTitle : pageTitle,
        pageSubtitle: pick("pageSubtitle") as string,
        certificateImage: /^https:\/\//i.test(v.certificateImage?.trim() ?? "") ? v.certificateImage.trim() : null,
        programName: pick("programName") as string,
        cohortLabel: pick("cohortLabel") as string,
        cohortDates: pick("cohortDates") as string,
        statement: pick("statement") as string,
        issuerName: pick("issuerName") as string,
        issuerTagline: pick("issuerTagline") as string,
        presenterName: pick("presenterName") as string,
        presenterTagline: pick("presenterTagline") as string,
        credentialName: pick("credentialName") as string,
        linkedinOrganizationName: pick("linkedinOrganizationName") as string,
        linkedinOrganizationId: /^\d+$/.test(v.linkedinOrganizationId ?? "") ? v.linkedinOrganizationId : null,
        shareText: pick("shareText") as string,
        shareXHandles: pick("shareXHandles") as string,
        shareLinkedinHandles: pick("shareLinkedinHandles") as string,
        shareHashtags: pick("shareHashtags") as string,
        detailsLine: "",
      };
      value.detailsLine = detailsLine(value, order);
    } catch (err) {
      console.warn("⚠️ Could not load certificate wording from SI3 CMS:", (err as Error).message);
      if (cache) return cache.value;
    }
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }
}
