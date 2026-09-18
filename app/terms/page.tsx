export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#1a1a1a" }}>
      <h1>Terms of Service</h1>
      <p style={{ color: "#666", fontSize: 13 }}>Last updated: [DATE — fill in before launch]</p>

      <p>
        <strong>This is a starting template, not a finished legal document.</strong> Replace
        the bracketed placeholders and have it reviewed by a lawyer licensed in your
        jurisdiction before relying on it — this file is here so the signup flow has
        something to link to during development, not as a substitute for legal advice.
      </p>

      <h2>1. Accounts</h2>
      <p>
        You must provide accurate information when creating an account. You're responsible
        for activity under your account and for keeping your credentials secure.
      </p>

      <h2>2. Subscription tiers and billing</h2>
      <p>
        [Company name] offers Free, Indie Artist, Indie Label, and Enterprise Label tiers as
        described at signup. Paid tiers are billed in advance on a recurring basis via
        Stripe. You can cancel at any time; cancellation takes effect at the end of the
        current billing period. [Describe refund policy, if any.]
      </p>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of the booklets, images, audio, and metadata you upload. You
        grant us a license to store, process, and display that content solely to provide
        the service to you (and, for content in a released/exported booklet, to whoever you
        share the export with). You're responsible for having the rights to everything you
        upload.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        Don't use the service to infringe others' rights, upload malware, or attempt to
        circumvent the tier limits or security of the platform.
      </p>

      <h2>5. Termination</h2>
      <p>[Describe grounds for suspension/termination and data retention after account closure.]</p>

      <h2>6. Disclaimers and liability</h2>
      <p>[Standard "as-is" disclaimer and liability limitation — have counsel draft this section specifically.]</p>

      <h2>7. Changes to these terms</h2>
      <p>[Describe how you'll notify users of changes.]</p>

      <h2>8. Contact</h2>
      <p>Questions about these terms: [support email].</p>
    </main>
  );
}
