import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const lastUpdated = "1 January 2025";
const companyName = "Examly";
const contactEmail = "legal@examly.co.uk";
const websiteUrl = "examly.co.uk";

const sections: { title: string; content: string }[] = [
  {
    title: "1. Acceptance of terms",
    content: `By creating an account or using ${companyName} you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms do not use the service.

If you are under 18 you confirm that you have your parent or guardian's permission to use ${companyName} and to agree to these terms on your behalf. If you are a parent or guardian permitting a minor to use ${companyName} you agree to be responsible for that minor's use of the service.

We may update these terms from time to time. We will notify you of significant changes by email and by displaying a notice in the application. Your continued use of ${companyName} after changes are posted constitutes acceptance of the updated terms.`,
  },
  {
    title: "2. Description of service",
    content: `${companyName} is an AI-powered exam practice platform that helps students prepare for examinations by generating practice questions, tracking progress, and identifying areas for improvement. The platform also provides tools for tutors to manage classes, assign exams, and monitor student progress.

${companyName} is a web-based application accessible through modern web browsers. We do not currently offer a native mobile application.

We reserve the right to modify, suspend, or discontinue any part of the service at any time with reasonable notice where possible. We will not be liable to you for any modification, suspension, or discontinuation of the service.`,
  },
  {
    title: "3. Account registration",
    content: `To use ${companyName} you must create an account by providing accurate and complete information. You are responsible for maintaining the security of your account and password.

You must notify us immediately at ${contactEmail} if you become aware of any unauthorised use of your account.

You may not create an account on behalf of another person without their explicit permission. You may not create multiple accounts for the purpose of circumventing usage limits.

We reserve the right to terminate accounts that violate these terms or that have been inactive for more than 24 months following the notice process described in our Privacy Policy.`,
  },
  {
    title: "4. Acceptable use",
    content: `You agree to use ${companyName} only for lawful purposes and in accordance with these terms. You must not:

Use the service to generate content that is discriminatory, harmful, abusive, or illegal.

Attempt to reverse engineer, copy, or replicate the AI question generation system or any other proprietary part of the service.

Use automated tools, bots, or scripts to generate questions at a rate that exceeds normal human usage or that circumvents usage limits.

Share account credentials with other users or allow others to access your account.

Attempt to gain unauthorised access to any part of the service, other users' accounts, or our infrastructure.

Use the service to prepare for examinations in a way that constitutes academic dishonesty as defined by your institution. ${companyName} is designed as a legitimate study tool and you are responsible for ensuring your use complies with your institution's academic integrity policies.

Misrepresent your age or the age of a minor you are registering on behalf of.

We reserve the right to suspend or terminate your account if you violate these acceptable use terms.`,
  },
  {
    title: "5. AI-generated content",
    content: `${companyName} uses artificial intelligence to generate practice questions and model answers. You acknowledge and agree that:

AI-generated content may contain errors, inaccuracies, or outdated information. You should not rely solely on ${companyName} content for your examination preparation. Always cross-reference with your official syllabus, textbooks, and teacher guidance.

The questions generated are for practice purposes only. We make no guarantee that questions will match the exact style, difficulty, or content of any specific examination.

AI-generated content is provided as-is without warranty of accuracy or fitness for any particular purpose.

You can report inaccurate questions using the feedback feature. We review reports and update our systems accordingly but cannot guarantee that every reported issue will be corrected immediately.

The intellectual property in AI-generated questions belongs to ${companyName}. You may use generated questions for your own personal study purposes but may not reproduce or distribute them commercially.`,
  },
  {
    title: "6. Tutor responsibilities",
    content: `If you use ${companyName} as a tutor you agree that:

You are responsible for ensuring that your use of ${companyName} with students complies with all applicable laws and your institution's policies including data protection laws and safeguarding requirements.

You will only add students to your classes with their consent and, where required by law, the consent of their parent or guardian.

You will not share students' personal data or progress data with third parties without appropriate authorisation.

You are responsible for the accuracy of any exam content you review and approve before assigning it to students. While ${companyName} reviews AI-generated content you are the final check before students see assigned material.

You will comply with your professional duties and safeguarding obligations in your interactions with students through the platform.`,
  },
  {
    title: "7. Payments and subscriptions",
    content: `${companyName} is currently free to use and we do not collect any payment information. If we introduce paid subscription tiers in the future the following terms will apply, and we will update this page and notify users in the application before any charges are made:

Subscriptions will be billed in advance on a monthly or annual basis. Prices will be displayed on our pricing page and are inclusive of applicable taxes.

You will have the right to cancel your subscription at any time. For digital services under UK Consumer Contracts Regulations you have a 14-day cooling off period from the date of purchase unless you have already accessed the paid features, in which case you would expressly waive this right by accessing the service.

We will provide reasonable notice of any price changes before they take effect.

Refunds for partial subscription periods will not be provided except where required by law.

Payment processing will be handled by a PCI DSS compliant third-party payment processor. We will name that processor in this policy before any paid plan launches.`,
  },
  {
    title: "8. Intellectual property",
    content: `${companyName} and its content, features, and functionality are owned by ${companyName} and are protected by copyright, trademark, and other intellectual property laws.

You retain ownership of any content you upload to the platform such as exam papers or syllabus documents. By uploading content you grant ${companyName} a limited licence to process that content for the purpose of generating practice questions for your use.

You may not copy, reproduce, distribute, or create derivative works from any part of ${companyName} without our explicit written permission.

The ${companyName} name and logo are trademarks. You may not use them without our written permission.`,
  },
  {
    title: "9. Limitation of liability",
    content: `To the fullest extent permitted by applicable law:

${companyName} is provided on an "as is" and "as available" basis without any warranty of any kind whether express or implied.

We do not warrant that the service will be uninterrupted, error-free, or that defects will be corrected.

We shall not be liable for any indirect, incidental, special, consequential, or punitive damages including loss of profits, data, or goodwill arising from your use of or inability to use the service.

Our total liability to you for any claims arising from your use of the service shall not exceed the amount you paid to us in the 12 months preceding the claim, or £50 if you are on the free tier.

Nothing in these terms excludes or limits our liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be excluded by law.

If you are a consumer in the UK or EU you have statutory rights that these terms do not affect.`,
  },
  {
    title: "10. Termination",
    content: `You may delete your account at any time from Settings → Privacy & Data. Deletion is permanent and we cannot recover deleted accounts.

We may suspend or terminate your account if you violate these terms, if we are required to do so by law, or if your account has been inactive for 24 months following the notice process in our Privacy Policy.

On termination all licences granted to you under these terms will end. Sections that by their nature should survive termination will do so including Sections 5, 8, 9, and 11.`,
  },
  {
    title: "11. Governing law and disputes",
    content: `These terms are governed by the laws of England and Wales. Any disputes arising from these terms or your use of ${companyName} that cannot be resolved informally will be subject to the exclusive jurisdiction of the courts of England and Wales.

If you are a consumer in the EU you may also bring proceedings in the courts of your country of residence.

We will always try to resolve disputes informally first. If you have a complaint please contact us at ${contactEmail} and we will aim to respond within 14 days.

EU residents may also use the European Commission's Online Dispute Resolution platform at ec.europa.eu/consumers/odr.`,
  },
  {
    title: "12. Contact",
    content: `For questions about these terms contact us at:

Email: ${contactEmail}
Website: ${websiteUrl}

We aim to respond to all legal enquiries within 14 days.`,
  },
];

const Terms = () => {
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
          <span className="text-sm font-semibold text-foreground">Terms of Service</span>
          <span className="w-12" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-start gap-4 mb-10">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Last updated: {lastUpdated} · Please read these terms carefully
              before using {companyName}.
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
          These terms were last updated on {lastUpdated}. Questions? Contact{" "}
          <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
            {contactEmail}
          </a>
          .
        </div>
      </main>
    </div>
  );
};

export default Terms;
