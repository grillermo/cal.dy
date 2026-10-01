import { _generateMetadata } from "app/_utils";

export const generateMetadata = async () =>
  await _generateMetadata(
    () => "Privacy Policy",
    () => "",
    undefined,
    undefined,
    "/policy"
  );

const PrivacyPolicyPage = () => {
  return (
    <div className="px-4">
      <article className="bg-default border-subtle text-default mx-auto my-8 max-w-3xl rounded-xl border p-8 shadow-sm">
        <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-subtle mb-8">Last updated: May 28, 2026</p>

        <p className="mb-6">
          Cal.diy (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides a scheduling service that lets
          you publish booking pages, share your availability, and create events in your connected calendars
          (the &quot;Service&quot;). This Privacy Policy explains what information we collect, how we use it,
          and the choices you have. By using the Service you agree to the practices described here.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-2 mb-6">
          <li>
            <strong>Account information.</strong> Your name, email address, and sign-in credentials, used to
            create and authenticate your account.
          </li>
          <li>
            <strong>Google account data.</strong> When you connect Google Calendar, we receive an OAuth access
            token that lets the Service read your calendars to check when you are busy and create, update, or
            cancel the events booked through the Service.
          </li>
          <li>
            <strong>Scheduling data.</strong> The event types, availability, and settings you configure, and
            the bookings made with you, including the name, email address, and any details provided by the
            people who book.
          </li>
          <li>
            <strong>Usage and log data.</strong> Technical information such as IP address, browser type, and
            timestamps, collected automatically to operate and secure the Service.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. How We Use Information</h2>
        <ul className="list-disc pl-6 space-y-2 mb-6">
          <li>To provide, maintain, and improve the Service.</li>
          <li>To check your availability and create, update, or cancel calendar events for your bookings.</li>
          <li>To authenticate you and secure your account.</li>
          <li>To communicate with you about the Service, including service-related notices.</li>
          <li>To comply with legal obligations and enforce our terms.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Google User Data</h2>
        <p className="mb-4">
          Cal.diy&apos;s use and transfer of information received from Google APIs adheres to the
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-blue-700 hover:underline"
            target="_blank"
            rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>

        <h3 className="text-base font-semibold mt-6 mb-2">How we access Google data</h3>
        <p className="mb-4">
          When you connect Google Calendar, we request the <code>calendar.readonly</code> and{" "}
          <code>calendar.events</code> OAuth scopes, which allow us to read your calendars and their events
          and to create, update, and delete events — all on your behalf and only to check your availability
          and manage your bookings. We also request your basic profile information, and <code>openid</code>,{" "}
          <code>email</code>, and <code>profile</code> if you sign in with Google. No access occurs outside of
          providing these scheduling features or re-authenticating your session.
        </p>

        <h3 className="text-base font-semibold mt-6 mb-2">How we use Google data</h3>
        <p className="mb-4">
          Google Calendar data is used exclusively to provide the scheduling features you have requested. We
          read your events only to determine when you are busy and to keep your bookings in sync, and we write
          only the events that result from your bookings. We do not use Google Calendar data for advertising,
          profiling, training machine learning models, or any purpose unrelated to those scheduling features.
        </p>

        <h3 className="text-base font-semibold mt-6 mb-2">How we store Google data</h3>
        <p className="mb-4">
          OAuth access tokens and refresh tokens are stored in our database with restricted access and are
          used solely to authenticate API requests on your behalf. Calendar data read from Google is used to
          compute your availability and may be cached temporarily for that purpose; the bookings made through
          the Service, and the identifiers of the calendar events created for them, are stored for as long as
          your account is active. Application logs may temporarily contain metadata (e.g., event IDs) for
          operational purposes; these are retained for a limited period and then deleted. You can disconnect
          Google Calendar at any time, which permanently removes your stored tokens.
        </p>

        <h3 className="text-base font-semibold mt-6 mb-2">How we share Google data</h3>
        <p className="mb-4">
          We do not sell, rent, or share your Google Calendar data with third parties for their own purposes.
          Data may be processed by infrastructure service providers (hosting, database) acting on our behalf
          under confidentiality obligations. We do not allow humans to read your calendar data except where
          required for security incident investigation, to comply with applicable law, or with your explicit
          prior consent. We do not transfer Google Calendar data in connection with advertising, credit
          evaluation, or any data brokerage use.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. How We Share Information</h2>
        <p className="mb-3">We do not sell your personal information. We share information only:</p>
        <ul className="list-disc pl-6 space-y-2 mb-6">
          <li>
            With service providers (such as hosting and infrastructure vendors) who process data on our behalf
            under confidentiality obligations.
          </li>
          <li>
            When required by law, legal process, or to protect the rights, safety, and security of users or
            the public.
          </li>
          <li>In connection with a merger, acquisition, or sale of assets, subject to this Policy.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Retention</h2>
        <p className="mb-6">
          We retain your account information, configuration, and bookings for as long as your account is
          active. Calendar data from connected accounts is not stored beyond what is necessary to provide the
          Service. You may delete your account at any time, after which we delete or anonymize your data
          except where retention is required by law.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Security</h2>
        <p className="mb-6">
          We use industry-standard technical and organizational measures to protect your information,
          including encryption in transit and restricted access to credentials. No method of transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Rights and Choices</h2>
        <ul className="list-disc pl-6 space-y-2 mb-6">
          <li>
            You can disconnect Google Calendar at any time, which revokes our access to your calendars. You
            may also revoke access from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-blue-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer">
              Google Account permissions
            </a>{" "}
            page.
          </li>
          <li>
            Depending on your location, you may have rights to access, correct, delete, or export your
            personal data. Contact us to exercise these rights.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">8. International Users</h2>
        <p className="mb-6">
          Your information may be processed in countries other than your own. Where required, we use
          appropriate safeguards for cross-border transfers.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">9. Children&apos;s Privacy</h2>
        <p className="mb-6">
          The Service is not directed to children under 13 (or the minimum age in your jurisdiction), and we
          do not knowingly collect their personal information.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">10. Changes to This Policy</h2>
        <p className="mb-6">
          We may update this Policy from time to time. We will post the updated version here and revise the
          &quot;Last updated&quot; date. Material changes may be communicated through the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">11. Contact Us</h2>
        <p className="mb-2">
          If you have questions about this Privacy Policy or our data practices, contact us at:
        </p>
        <p className="mb-6">
          <a href="mailto:guillermo.siliceo@gmail.com" className="text-blue-700 hover:underline">
            guillermo.siliceo@gmail.com
          </a>
        </p>
      </article>
    </div>
  );
};

export default PrivacyPolicyPage;
