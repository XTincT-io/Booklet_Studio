export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6, color: "#1a1a1a" }}>
      <h1>Privacy Policy</h1>
      <p style={{ color: "#666", fontSize: 13 }}>Last updated: [DATE — fill in before launch]</p>

      <p>
        <strong>This is a starting template, not a finished legal document.</strong> Replace
        the bracketed placeholders and have it reviewed before relying on it, especially if
        you'll have users in the EU/UK (GDPR) or California (CCPA) — this describes what
        the app actually collects today; it doesn't independently make you compliant.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> email, name (optional), hashed password.</li>
        <li><strong>Content you create:</strong> project/booklet data, uploaded images and audio, metadata (title, artist, tracklist, etc.).</li>
        <li>
          <strong>Usage analytics on your releases:</strong> when someone views a booklet you
          published, we record a page-view / hotspot-open / audio-play event tied to the
          project — no personal data about the viewer is collected (see <code>lib/analytics.ts</code>).
        </li>
        <li><strong>Audit log:</strong> Enterprise-tier orgs get an append-only log of membership and permission changes, tied to the acting user's id.</li>
        <li><strong>Billing data:</strong> handled by Stripe directly — we store your Stripe customer/subscription id, not your card details.</li>
      </ul>

      <h2>Third parties we share data with</h2>
      <ul>
        <li><strong>Stripe</strong> — payment processing.</li>
        <li><strong>[Your cloud provider, e.g. AWS S3]</strong> — file storage for uploaded images/audio and generated exports.</li>
        <li><strong>[Your email provider, if configured]</strong> — transactional email (password reset, etc.).</li>
        <li><strong>Your organization's identity provider</strong> (Enterprise SSO only) — if your org admin enables SSO, your IdP handles authentication; we receive your email/name from it.</li>
      </ul>

      <h2>Data retention and deletion</h2>
      <p>
        [Describe how long data is kept after account/org deletion, and how a user requests
        deletion — see the "Still open" list in this project's deployment notes: account/org
        self-service deletion isn't built yet, which this section needs to reflect honestly
        until it is.]
      </p>

      <h2>Your rights</h2>
      <p>[Describe access/correction/deletion/portability rights applicable in your users' jurisdictions.]</p>

      <h2>Contact</h2>
      <p>Questions about this policy: [support email].</p>
    </main>
  );
}
