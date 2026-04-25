import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const lastUpdated = "1 January 2025";
const companyName = "Examly";
const contactEmail = "privacy@examly.co.uk";
const websiteUrl = "examly.co.uk";

const sections: { title: string; content: string }[] = [
  {
    title: "1. Who we are",
    content: `${companyName} ("we", "us", "our") operates the ${websiteUrl} website and associated mobile-optimised web application. We provide an AI-powered exam practice platform for students and tutors worldwide.

For the purposes of UK GDPR and EU GDPR, ${companyName} is the data controller responsible for your personal data. If you have any questions about this policy or how we handle your data, contact us at ${contactEmail}.

We are registered with the Information Commissioner's Office (ICO) as a data controller.`,
  },
  {
    title: "2. What data we collect",
    content: `We collect the following categories of personal data:

Account data — your name, email address, password (stored as an encrypted hash), country, and account creation date.

Profile data — your educational level, subjects studied, exam boards selected, study goals, and regional preferences.

Usage data — practice quiz results, exam scores, answers submitted, time spent on questions, weak topics identified, and study session history.

Technical data — your IP address, browser type, device type, and approximate location derived from IP address. We use this only for security and service improvement purposes.

Communications — any messages you send through feedback forms or support requests.

Payment data — if you subscribe to a paid plan, payment is processed by Stripe. We do not store your card details. We receive a transaction ID and subscription status from Stripe.

Children's data — if you are under 18, we collect the same categories of data described above. We apply additional protections to data relating to users under 18 as described in Section 9 of this policy.`,
  },
  {
    title: "3. How we use your data",
    content: `We use your personal data for the following purposes:

To provide the service — generating practice questions, tracking your progress, identifying weak topics, and enabling tutor-student class features. Legal basis: performance of a contract.

To personalise your experience — adapting question difficulty, subject coverage, and curriculum style to your educational level and country. Legal basis: legitimate interests.

To improve the platform — analysing anonymised usage patterns to understand which features work well and which need improvement. Legal basis: legitimate interests.

To communicate with you — sending emails about your account, exam assignments from your tutor, and service updates. Legal basis: performance of a contract and legitimate interests.

To send marketing communications — only if you have explicitly opted in during signup. Legal basis: consent. You can withdraw consent at any time by clicking unsubscribe in any marketing email.

To comply with legal obligations — retaining certain records as required by law. Legal basis: legal obligation.

We do not use your data for automated decision-making that produces legal or similarly significant effects on you.`,
  },
  {
    title: "4. AI-generated content and your data",
    content: `${companyName} uses AI models (currently Google Gemini) to generate practice questions based on your selected subjects, topics, and educational level.

When generating questions we send the following information to the AI provider: your selected subject, topic, educational level, exam board, and question format preferences. We do not send your name, email address, or any personally identifying information to AI providers.

Question generation requests are processed by Google's AI infrastructure. Google's privacy policy applies to this processing. We have a data processing agreement in place with Google.

Your answers to practice questions and exam submissions are stored in our own database. They are not sent to any AI provider.

We cache generated questions to reduce costs and improve response times. Cached questions are stored in our database and are not shared between users in a way that identifies you.`,
  },
  {
    title: "5. Who we share your data with",
    content: `We share your data with the following categories of third parties:

Infrastructure providers — Supabase (database and authentication, hosted in the EU), Vercel or equivalent (web hosting).

AI providers — Google (Gemini AI for question generation) as described in Section 4.

Payment processors — Stripe (payment processing for paid subscriptions). Stripe is PCI DSS compliant.

Tutors — if you join a tutor's class your tutor can see your name, exam results for assigned exams, and progress within their class. They cannot see your practice quiz results, your account email, or your activity outside their class.

We do not sell your personal data to any third party. We do not share your data with advertisers.

We may disclose your data if required to do so by law or in response to valid legal requests from public authorities.`,
  },
  {
    title: "6. How long we keep your data",
    content: `We retain your personal data for the following periods:

Account data — for as long as your account is active. If you delete your account we delete your personal data within 30 days, except where we are required to retain it by law.

Exam and practice results — retained for as long as your account is active. You can export this data at any time from Settings → Privacy & Data.

Payment records — retained for 7 years as required by UK tax law, even after account deletion.

Anonymised usage data — we may retain anonymised and aggregated data indefinitely for research and service improvement purposes. This data cannot be used to identify you.

Server logs — retained for 90 days for security purposes then automatically deleted.

If you do not use your account for 24 months we will send you an email asking if you want to keep it active. If you do not respond within 30 days we will delete your account and associated data.`,
  },
  {
    title: "7. Your rights under UK and EU GDPR",
    content: `You have the following rights regarding your personal data:

Right to access — you can request a copy of all personal data we hold about you. You can also download your data directly from Settings → Privacy & Data.

Right to rectification — you can correct inaccurate data by updating your profile in Settings.

Right to erasure — you can delete your account and all associated data from Settings → Privacy & Data. We will process deletions within 30 days.

Right to data portability — you can export your data in JSON format from Settings → Privacy & Data at any time.

Right to restrict processing — you can ask us to restrict how we use your data in certain circumstances.

Right to object — you can object to processing based on legitimate interests. You can opt out of marketing emails at any time.

Right to withdraw consent — where processing is based on consent you can withdraw it at any time without affecting the lawfulness of processing before withdrawal.

To exercise any of these rights contact us at ${contactEmail}. We will respond within 30 days. You also have the right to lodge a complaint with the ICO at ico.org.uk or with your local supervisory authority if you are in the EU.`,
  },
  {
    title: "8. Cookies and tracking",
    content: `We use the following types of cookies:

Strictly necessary cookies — required for the platform to function. These include your authentication session token and security tokens. You cannot opt out of these as the service cannot function without them.

Preference cookies — remember your settings such as theme preference (light or dark mode) and language. These are stored locally in your browser.

Analytics cookies — we use anonymised analytics to understand how the platform is used. These do not identify you personally. You can opt out of analytics cookies using our cookie consent banner.

We do not use advertising cookies or tracking pixels. We do not allow third-party advertising on the platform.

You can manage cookie preferences using the cookie settings banner which appears when you first visit the site. You can change your preferences at any time by clicking Cookie Settings in the footer.`,
  },
  {
    title: "9. Children's privacy",
    content: `We take children's privacy seriously and comply with the UK ICO Age Appropriate Design Code, US COPPA, and applicable children's privacy laws globally.

Users under 13 — we do not knowingly collect personal data from children under 13 without verifiable parental consent. If you are under 13 a parent or guardian must register on your behalf. If we discover we have collected data from a child under 13 without parental consent we will delete it promptly.

Users aged 13-17 — we collect only the data necessary to provide the service. We do not use data from users under 18 for marketing profiling. We do not use nudge techniques or dark patterns to encourage users under 18 to spend money or share additional data. We apply the highest privacy settings by default for users under 18.

Parental rights — parents or guardians of users under 13 can request to review, correct, or delete their child's data by contacting ${contactEmail} with proof of parental relationship.

If you are a tutor adding students to your class you confirm that you have appropriate consent from students and their parents or guardians as required by your local law and your institution's policies.`,
  },
  {
    title: "10. International data transfers",
    content: `${companyName} operates globally and your data may be processed in countries other than your own.

For UK and EU users — your data is primarily stored on Supabase infrastructure in the EU. Where data is transferred outside the UK or EU we ensure appropriate safeguards are in place including Standard Contractual Clauses approved by the European Commission.

For US users — your data may be processed in the EU. We comply with applicable US state privacy laws including the California Consumer Privacy Act (CCPA) where applicable. California residents have additional rights including the right to know what personal information is collected, the right to delete, and the right to opt out of sale of personal information. We do not sell personal information.

For users in other countries — we process your data in accordance with this policy and applicable local law. Contact us at ${contactEmail} if you have questions about how your local laws apply.`,
  },
  {
    title: "11. Security",
    content: `We take the security of your data seriously and implement appropriate technical and organisational measures including:

Encryption — all data is encrypted in transit using TLS 1.2 or higher. Passwords are stored as salted hashes and are never stored in plain text.

Access controls — access to personal data is restricted to personnel who need it to provide the service. All access is logged and audited.

Infrastructure security — we use Supabase which implements row-level security ensuring users can only access their own data.

Vulnerability management — we keep all software dependencies up to date and monitor for security vulnerabilities.

Despite these measures no system is completely secure. If you discover a security vulnerability please report it to ${contactEmail} and we will address it promptly.

In the event of a data breach that is likely to result in a risk to your rights and freedoms we will notify you and the relevant supervisory authority within 72 hours of becoming aware of it.`,
  },
  {
    title: "12. Changes to this policy",
    content: `We may update this privacy policy from time to time. When we make significant changes we will notify you by email and display a notice in the application. The date at the top of this policy shows when it was last updated.

Your continued use of ${companyName} after changes are posted constitutes acceptance of the updated policy. If you do not agree with changes you can delete your account from Settings → Privacy & Data.`,
  },
  {
    title: "13. Contact us",
    content: `If you have any questions about this privacy policy or how we handle your data please contact us:

Email: ${contactEmail}
Website: ${websiteUrl}

For complaints about how we have handled your data you can also contact the ICO at ico.org.uk (for UK users) or your local supervisory authority (for EU users).

We aim to respond to all privacy-related enquiries within 30 days.`,
  },
];

const Privacy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto h-14 px-4 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="text-sm font-semibold text-foreground">Privacy Policy</span>
          <span className="w-12" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Last updated: {lastUpdated} · This policy explains how {companyName}{" "}
              collects, uses, and protects your personal data.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold mb-3 text-foreground">
                {section.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 pt-8 border-t border-border/60 text-xs text-muted-foreground/80">
          This privacy policy was last updated on {lastUpdated}. If you have
          questions contact{" "}
          <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
            {contactEmail}
          </a>
          .
        </div>
      </main>
    </div>
  );
};

export default Privacy;
