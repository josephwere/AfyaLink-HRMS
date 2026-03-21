import { useEffect } from "react";
import LegalLinks from "../../components/LegalLinks";
import { useSystemSettings } from "../../utils/systemSettings.jsx";

const sections = [
  {
    title: "1. Overview",
    body: [
      "This Privacy Policy explains how AfyaLink collects, uses, stores, shares, and protects personal data and related operational information when patients, hospitals, staff, regulators, and partners use the platform.",
      "AfyaLink processes information needed to provide healthcare operations, workforce management, communication, claims, fraud prevention, analytics, compliance, and AI-assisted product features.",
      "Privacy obligations may vary depending on who is acting as the data controller in a particular deployment, including hospitals, employers, government agencies, insurers, and AfyaLink itself for platform administration data.",
    ],
  },
  {
    title: "2. Data We Collect",
    body: [
      "We may collect account and identity information such as names, emails, phone numbers, national IDs, health IDs, employee details, professional credentials, login metadata, and device/session information.",
      "We may process healthcare and operational data including appointments, encounters, referrals, claims, invoices, lab records, prescriptions, transfers, communication records, support tickets, audit logs, workflow decisions, and uploaded documents or images.",
      "We may also collect settings, branding assets, system diagnostics, API telemetry, fraud signals, model prompts, AI outputs, and administrator actions needed to secure and operate the service.",
    ],
  },
  {
    title: "3. How We Use Information",
    body: [
      "We use data to provide and secure the platform, authenticate users, deliver workflows, support hospitals and patients, process claims and payments, monitor fraud risk, troubleshoot issues, and improve reliability and usability.",
      "We use limited data for support, communications, service notices, quality assurance, incident response, and audit/compliance operations.",
      "Where AI features are enabled, we use relevant input context to generate summaries, autofill drafts, suggestions, extraction results, and workflow assistance. AI outputs are designed to support, not replace, human review.",
    ],
  },
  {
    title: "4. Legal and Operational Bases",
    body: [
      "AfyaLink processes data based on one or more lawful grounds available under applicable law, such as performance of a contract, legitimate interests, legal obligations, public-interest duties, employment administration, healthcare delivery, or consent where required.",
      "For deployments in Kenya and similar jurisdictions, users and customer organizations may have rights and obligations under applicable data protection laws, including rights to notice, access, correction, objection, and complaint handling.",
      "Customers using AfyaLink remain responsible for determining and documenting the lawful basis for the data they control and for issuing appropriate privacy notices to patients, staff, and other data subjects.",
    ],
  },
  {
    title: "5. Sharing and Disclosure",
    body: [
      "We may share data with authorized users within the relevant organization, contracted processors, infrastructure providers, identity or messaging vendors, payment or telecom partners, auditors, and regulators where required to provide the service or comply with law.",
      "We may disclose information to prevent fraud, protect patient safety, investigate abuse, enforce contractual rights, or respond to lawful requests, court orders, or regulator instructions.",
      "We do not sell personal health information for unrelated advertising purposes.",
    ],
  },
  {
    title: "6. Security and Integrity",
    body: [
      "AfyaLink uses administrative, technical, and organizational safeguards such as access controls, authentication steps, audit trails, encryption in transit, environment separation, incident monitoring, role restrictions, and fraud detection workflows.",
      "No system is perfectly secure, so customers and users must also protect devices, credentials, local networks, uploaded content, and account recovery channels.",
      "Where available, digital signatures, provenance records, immutable logging, and policy enforcement are used to improve record integrity and post-incident traceability.",
    ],
  },
  {
    title: "7. Retention",
    body: [
      "We retain data for as long as needed to provide the service, support legal and contractual obligations, preserve auditability, resolve disputes, detect abuse, or meet customer-configured retention rules.",
      "Different categories of data may have different retention periods, including claims, billing, audit logs, workforce records, communication logs, and support records.",
      "When retention is no longer required, data may be deleted, anonymized, or de-identified in accordance with applicable law, contract, and operational policy.",
    ],
  },
  {
    title: "8. International and Cross-Organization Transfers",
    body: [
      "AfyaLink may support multi-country and cross-organization workflows. Where data is transferred across borders or between authorized institutions, appropriate technical, contractual, and governance measures should be applied for the deployment.",
      "Customers remain responsible for enabling only those integrations and transfer pathways that are lawful for their jurisdiction and clinical or regulatory use case.",
    ],
  },
  {
    title: "9. Your Choices and Rights",
    body: [
      "Depending on your role and applicable law, you may have rights to access, correct, update, export, object to, restrict, or request deletion of certain personal data.",
      "Requests relating to patient or employee records may need to be handled first by the relevant hospital, employer, or public authority that controls the underlying record.",
      "You may also manage some account settings directly in the product, such as profile data, password settings, access controls, communication preferences, and certain workspace options.",
    ],
  },
  {
    title: "10. Children and Sensitive Data",
    body: [
      "AfyaLink may process pediatric and other sensitive records only as necessary for lawful healthcare, administrative, or public-interest operations authorized by the responsible controller.",
      "Organizations using AfyaLink should ensure that the required notices, consents, safeguards, and access restrictions are in place for minors and sensitive categories of information.",
    ],
  },
  {
    title: "11. Updates to This Policy",
    body: [
      "We may update this Privacy Policy when the product, legal landscape, or deployment requirements change. Material updates should be published with a revised effective date.",
      "Continued use of AfyaLink after an update takes effect means the updated policy applies, subject to any stricter requirements under applicable law or contract.",
    ],
  },
  {
    title: "12. Contact and Complaints",
    body: [
      "Questions about privacy, data access, security incidents, or controller/processor responsibilities should be directed to the privacy, compliance, or support contact for the relevant AfyaLink deployment.",
      "If you believe your data has been handled unlawfully, you may also have the right to complain to the relevant supervisory or regulatory authority in your jurisdiction.",
    ],
  },
];

export default function PrivacyPolicy() {
  const { settings } = useSystemSettings();
  const appName = settings?.branding?.appName || "AfyaLink";

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  return (
    <div className="dashboard legal-page">
      <div className="welcome-panel legal-hero">
        <div>
          <p className="legal-kicker">Legal</p>
          <h2>{appName} Privacy Policy</h2>
          <p className="muted">
            This policy explains how AfyaLink handles patient, staff, hospital, financial, support, and AI-assistance data across the platform.
          </p>
        </div>
        <LegalLinks compact />
      </div>

      <section className="section">
        <div className="card legal-intro-card">
          <p>
            Effective date: March 19, 2026. This policy is written for AfyaLink’s real workflows and should still be reviewed by qualified counsel before jurisdiction-specific publication.
          </p>
        </div>
      </section>

      {sections.map((section) => (
        <section className="section" key={section.title}>
          <div className="card legal-section-card">
            <h3>{section.title}</h3>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
