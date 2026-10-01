import { _generateMetadata } from "app/_utils";
import Link from "next/link";

export const generateMetadata = async () =>
  await _generateMetadata(
    () => "Terms of Service",
    () => "",
    undefined,
    undefined,
    "/tos"
  );

const TermsOfServicePage = () => {
  return (
    <div className="px-4">
      <article className="bg-default border-subtle text-default mx-auto my-8 max-w-3xl rounded-xl border p-8 shadow-sm">
        <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-sm text-subtle mb-8">Last updated: May 28, 2026</p>

        <p className="mb-6">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Cal.diy (&quot;we&quot;,
          &quot;us&quot;, or &quot;our&quot;) and the website, applications, and services we provide
          (collectively, the &quot;Service&quot;). By creating an account or otherwise using the Service, you
          agree to be bound by these Terms and by our
          <Link href="/policy" className="text-blue-700 hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">1. The Service</h2>
        <p className="mb-6">
          Cal.diy lets you publish booking pages, share your availability, and accept bookings. If you connect
          a calendar, such as Google Calendar through Google OAuth, the Service reads it to check when you are
          busy and creates, updates, or cancels events for your bookings. You control your event types,
          availability, and connected calendars and may modify or remove them at any time.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">2. Eligibility and Accounts</h2>
        <ul className="list-disc pl-6 space-y-2 mb-6">
          <li>
            You must be at least 13 years old (or the minimum age required in your jurisdiction) to use the
            Service.
          </li>
          <li>
            You are responsible for maintaining the confidentiality of your account credentials and for all
            activity that occurs under your account.
          </li>
          <li>You must provide accurate information and keep it up to date.</li>
          <li>You must promptly notify us of any unauthorized use of your account.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">3. Google Account and User Data</h2>
        <p className="mb-3">
          If you connect a Google account, you grant OAuth permission for the Service to access Google
          Calendar data. Our use and transfer of information received from Google APIs adheres to the
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-blue-700 hover:underline"
            target="_blank"
            rel="noopener noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p className="mb-6">
          You may revoke the Service&apos;s access at any time from your
          <a
            href="https://myaccount.google.com/permissions"
            className="text-blue-700 hover:underline"
            target="_blank"
            rel="noopener noreferrer">
            Google Account permissions
          </a>
          page or by disconnecting Google Calendar from within the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">4. Acceptable Use</h2>
        <p className="mb-3">You agree not to use the Service to:</p>
        <ul className="list-disc pl-6 space-y-2 mb-6">
          <li>Violate any applicable law, regulation, or third-party right.</li>
          <li>
            Access or manage calendars or accounts that do not belong to you or that you are not authorized to
            manage.
          </li>
          <li>
            Send spam, phishing, malware, or other harmful content, or otherwise use the Service to harass or
            defraud.
          </li>
          <li>
            Reverse engineer, decompile, or attempt to derive source code from the Service except as permitted
            by law.
          </li>
          <li>Interfere with, disrupt, or impose unreasonable load on the Service or its infrastructure.</li>
          <li>Resell, sublicense, or commercially exploit the Service without our written permission.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-3">5. Your Content</h2>
        <p className="mb-6">
          You retain ownership of the data in your connected calendars and of the event types, availability,
          and bookings you manage through the Service. You grant us a limited, non-exclusive license to
          access, process, and act on that content solely to operate the Service for you. You represent that
          you have all rights necessary to grant this license.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">6. Intellectual Property</h2>
        <p className="mb-6">
          The Service, including its software, design, and trademarks, is owned by us or our licensors and is
          protected by intellectual property laws. Except for the rights expressly granted in these Terms, we
          reserve all rights in the Service.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">7. Third-Party Services</h2>
        <p className="mb-6">
          The Service relies on third-party services, including Google APIs. Your use of those services is
          governed by their own terms and policies. We are not responsible for the availability, accuracy, or
          content of third-party services.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">8. Fees</h2>
        <p className="mb-6">
          The Service is currently provided without charge. We may introduce paid features in the future and
          will give you notice before any fees apply to your account.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">9. Disclaimers</h2>
        <p className="mb-6">
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
          KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT
          BOOKINGS, CALENDAR EVENTS, OR NOTIFICATIONS WILL BE CREATED OR DELIVERED WITHOUT DELAY, CONFLICT, OR
          LOSS. YOU ARE RESPONSIBLE FOR REVIEWING THE AVAILABILITY AND EVENT TYPES YOU CONFIGURE.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">10. Limitation of Liability</h2>
        <p className="mb-6">
          TO THE FULLEST EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUES, DATA, OR BOOKINGS, ARISING
          OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR CLAIMS RELATING TO THE
          SERVICE WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US$100) OR THE AMOUNT YOU PAID US, IF ANY, IN THE
          TWELVE MONTHS PRECEDING THE CLAIM, WHICHEVER IS GREATER.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">11. Indemnification</h2>
        <p className="mb-6">
          You agree to defend, indemnify, and hold us harmless from any claims, damages, or expenses
          (including reasonable legal fees) arising out of your use of the Service, your content, or your
          violation of these Terms or any law.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">12. Termination</h2>
        <p className="mb-6">
          You may stop using the Service and delete your account at any time. We may suspend or terminate your
          access if you violate these Terms, create risk or legal exposure for us, or if we discontinue the
          Service. Upon termination, your right to use the Service ends immediately. Provisions that by their
          nature should survive termination will survive.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">13. Changes to the Service or Terms</h2>
        <p className="mb-6">
          We may modify the Service or these Terms at any time. We will post the updated Terms here and revise
          the &quot;Last updated&quot; date. Material changes will take effect after we notify you or after a
          reasonable period. Your continued use of the Service after the effective date constitutes acceptance
          of the updated Terms.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">14. Governing Law and Disputes</h2>
        <p className="mb-6">
          These Terms are governed by the laws of the jurisdiction in which we are established, without regard
          to its conflict-of-laws principles. Disputes will be resolved in the courts located in that
          jurisdiction, unless mandatory consumer-protection laws of your place of residence require
          otherwise.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-3">15. Contact</h2>
        <p className="mb-2">Questions about these Terms can be sent to:</p>
        <p className="mb-6">
          <a href="mailto:guillermo.siliceo@gmail.com" className="text-blue-700 hover:underline">
            guillermo.siliceo@gmail.com
          </a>
        </p>
      </article>
    </div>
  );
};

export default TermsOfServicePage;
