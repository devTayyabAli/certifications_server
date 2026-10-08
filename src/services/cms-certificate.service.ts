import { CmsTableDef, readCmsTable } from "./cms-table.service";

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
  ],
};

export interface CertificateContent {
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
}

const DEFAULTS: CertificateContent = {
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
};

const CACHE_TTL_MS = 60 * 1000;
let cache: { expiresAt: number; value: CertificateContent } | null = null;

export class CmsCertificateService {
  static async getContent(): Promise<CertificateContent> {
    if (cache && cache.expiresAt > Date.now()) return cache.value;
    let value = DEFAULTS;
    try {
      const rows = await readCmsTable(CERTIFICATE_SECTION);
      const v = rows?.[0]?.values ?? {};
      const pick = (key: keyof CertificateContent) => (v[key]?.trim() ? v[key].trim() : DEFAULTS[key]);
      value = {
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
      };
    } catch (err) {
      console.warn("⚠️ Could not load certificate wording from SI3 CMS:", (err as Error).message);
      if (cache) return cache.value;
    }
    cache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
    return value;
  }
}
