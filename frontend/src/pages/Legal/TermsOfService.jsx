import LegalLinks from "../../components/LegalLinks";
import AuthPageShell from "../../components/AuthPageShell";
import { useSystemSettings } from "../../utils/systemSettings.jsx";

const sections = [
  {
    title: "1. Agreement and Scope",
    body: [
      "These Terms of Service govern access to and use of AfyaLink, including patient, hospital, workforce, finance, government, communication, and AI-assisted workflows made available through the platform.",
      "By creating an account, accessing the service, or continuing to use AfyaLink, you agree to these terms on behalf of yourself and, where applicable, the organization you represent.",
      "If you use AfyaLink for a hospital, clinic, government body, insurer, or partner organization, you confirm that you are authorized to bind that entity to these terms.",
    ],
  },
  {
    title: "2. Eligibility and Accounts",
    body: [
      "You must provide accurate, current, and complete registration information and keep it updated.",
      "You are responsible for account security, password protection, multi-factor steps, device security, and any actions taken under your credentials unless you promptly report unauthorized use.",
      "AfyaLink may suspend or restrict accounts that are fraudulent, inactive, unsafe, non-compliant, or otherwise in breach of these terms or applicable law.",
    ],
  },
  {
    title: "3. Healthcare and Operational Use",
    body: [
      "AfyaLink supports healthcare operations, workforce management, communication, claims processing, compliance, and AI-assisted drafting. It does not replace licensed clinical judgment, emergency services, or mandatory regulatory decision-making.",
      "Hospitals, clinicians, administrators, and regulators remain responsible for verifying records, diagnoses, prescriptions, referrals, approvals, billing decisions, and all patient-facing care actions before relying on platform outputs.",
      "AI-generated summaries, autofill results, risk flags, templates, and suggestions are assistive tools only and must be reviewed by an authorized human before use in care, claims, regulatory, payroll, or disciplinary decisions.",
    ],
  },
  {
    title: "4. Acceptable Use",
    body: [
      "You may not use AfyaLink to submit false claims, create ghost patients, falsify medical records, bypass audit controls, scrape restricted data, interfere with platform integrity, or access data beyond your authorization.",
      "You may not reverse engineer the service, upload malware, abuse messaging or calling features, or use the platform in a way that threatens patient safety, security, or lawful operations.",
      "You must comply with internal policies, professional obligations, payer rules, and applicable privacy, data protection, health, employment, fraud, and consumer laws.",
    ],
  },
  {
    title: "5. Data Ownership and Customer Responsibilities",
    body: [
      "As between AfyaLink and the customer organization, customer data remains owned or controlled by the applicable customer or data controller, subject to the permissions and processing rights required for service delivery.",
      "Customers are responsible for the lawful basis for collecting and submitting patient, staff, financial, and regulatory data into AfyaLink and for issuing required notices and obtaining required consents or authorizations.",
      "Customers must configure access roles appropriately, review audit logs, maintain local policies, and ensure uploaded records are lawful, accurate, and appropriate for the intended workflow.",
    ],
  },
  {
    title: "6. Payments, Billing, and Third-Party Services",
    body: [
      "Paid features, subscriptions, payment processing, telecom delivery, cloud hosting, identity checks, and external integrations may involve third-party providers with their own terms and availability constraints.",
      "Fees, taxes, usage limits, and premium features may vary by contract, plan, location, or feature set. Unless otherwise agreed, charges already incurred are non-refundable.",
      "You remain responsible for verifying payment instructions, payout settings, invoices, tax details, and external credential accuracy before enabling live financial operations.",
    ],
  },
  {
    title: "7. Availability, Maintenance, and Changes",
    body: [
      "AfyaLink works to maintain reliable service, but uptime is not guaranteed unless expressly covered in a separate service agreement.",
      "We may modify, improve, suspend, or retire features for security, compliance, operational, or product reasons. Where practical, material changes will be communicated in advance.",
      "Emergency maintenance, abuse prevention, regulator requests, incident response, or critical security controls may require immediate action without prior notice.",
    ],
  },
  {
    title: "8. Compliance, Fraud Prevention, and Audit",
    body: [
      "AfyaLink may log actions, signatures, approvals, AI usage, overrides, claim events, communications, and administrative changes to preserve security, compliance, and fraud-prevention evidence.",
      "Fraud signals, anomaly flags, or policy denials may result in step-up verification, restricted workflows, manual review, or immediate suspension pending investigation.",
      "Customers must cooperate with lawful audits, incident investigations, regulator requests, and forensic reviews related to the use of the platform.",
    ],
  },
  {
    title: "9. Intellectual Property",
    body: [
      "AfyaLink, including its software, interface design, workflows, models, branding, documentation, and non-customer content, is protected by intellectual property laws and remains owned by AfyaLink and its licensors.",
      "You receive a limited, revocable, non-exclusive right to use the service for your internal lawful purposes in accordance with these terms and any applicable commercial agreement.",
    ],
  },
  {
    title: "10. Termination",
    body: [
      "You may stop using AfyaLink at any time. AfyaLink may suspend or terminate access where required for security, legal compliance, non-payment, breach, abuse, or operational risk.",
      "Upon termination, access may end immediately, but retention, audit, billing, legal hold, and compliance obligations may continue for the periods required by law, contract, or legitimate operational need.",
    ],
  },
  {
    title: "11. Disclaimers and Liability",
    body: [
      "Except where prohibited by law or otherwise agreed in writing, AfyaLink is provided on an \"as available\" and \"as is\" basis.",
      "To the fullest extent permitted by law, AfyaLink disclaims implied warranties including merchantability, fitness for a particular purpose, and non-infringement.",
      "AfyaLink is not liable for indirect, incidental, special, consequential, exemplary, or lost-profit damages, or for outcomes caused by customer misuse, inaccurate source data, third-party outages, unlawful workflows, or unreviewed AI outputs.",
    ],
  },
  {
    title: "12. Governing Law and Contact",
    body: [
      "These terms are intended to operate alongside applicable local law, contractual obligations, and sector-specific regulatory requirements in the jurisdictions where AfyaLink is deployed.",
      "If any section is unenforceable, the remaining sections continue in effect.",
      "Questions about these terms, enterprise contracting, data processing, or legal notices should be directed through the official AfyaLink support or compliance contact published by your deploying organization.",
    ],
  },
];

export default function TermsOfService() {
  const { settings } = useSystemSettings();
  const appName = settings?.branding?.appName || "AfyaLink";

  return (
    <AuthPageShell>
    <div className="dashboard legal-page">
      <div className="welcome-panel legal-hero">
        <div>
          <p className="legal-kicker">Legal</p>
          <h2>{appName} Terms of Service</h2>
          <p className="muted">
            These terms describe how AfyaLink may be used across healthcare, workforce, financial, communication, compliance, and AI-assisted workflows.
          </p>
        </div>
        <LegalLinks compact />
      </div>

      <section className="section">
        <div className="card legal-intro-card">
          <p>
            Effective date: June 10, 2026. This document is a production-ready operating terms page for AfyaLink. It should still be reviewed by your legal counsel before public launch in any specific jurisdiction.
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
    </AuthPageShell>
  );
}
