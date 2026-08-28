import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Aether collects, protects, and handles your trading bot configurations and personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="24 August 2026">
      <p>
        At Aether Systems Pvt. Ltd. (&ldquo;Aether,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;), we take your privacy and the confidentiality of your quantitative strategies
        seriously. This Privacy Policy describes how we collect, process, store, and protect your personal
        information and proprietary bot data when you use the Aether web application, simulation tools,
        and platform services.
      </p>

      <h2>1. Our Quantitative Strategy Confidentiality Guarantee</h2>
      <p>
        We understand that your strategy logic, node configurations, indicators, threshold parameters,
        and mathematical rules represent sensitive intellectual property.
      </p>
      <ul>
        <li>
          <strong>No Front-Running or Counter-Trading:</strong> Aether will <strong>never</strong> monitor, analyze, reverse engineer, copy, or trade against your private strategies or backtest models.
        </li>
        <li>
          <strong>No Data Selling:</strong> We do not sell, rent, or monetize your strategy structures,
          backtest results, or personal information to hedge funds, high-frequency desks, brokerages, or
          advertising aggregators.
        </li>
        <li>
          <strong>Private by Default:</strong> All bots, nodes, and test parameters built on your canvas
          remain private to your authenticated workspace unless you explicitly choose to publish them as a
          public preset in the Aether Marketplace.
        </li>
      </ul>

      <h2>2. Information We Collect</h2>
      <p>We collect only the information necessary to provide and operate the platform:</p>
      <ul>
        <li>
          <strong>Account &amp; Identity Data:</strong> Your name, email address, password hash, profile
          bio, profile visibility preferences, and authentication session timestamps.
        </li>
        <li>
          <strong>Bot Graph &amp; Workspace Data:</strong> Node placements, layer configurations, custom
          parameters, sticky notes, canvas frames, version history snapshots, and simulation seeds.
        </li>
        <li>
          <strong>Backtest &amp; Performance Metrics:</strong> Run logs, equity curves, drawdown calculations,
          per-layer contribution statistics, and simulated order logs generated during your backtest and paper
          trading runs.
        </li>
        <li>
          <strong>Payment &amp; Billing Data:</strong> Transaction records, invoice history, and credit balance
          adjustments. Payment method details (credit cards, UPI IDs) are processed directly by our PCI-DSS
          compliant payment processors (e.g., Stripe / Razorpay) and are not stored on Aether servers.
        </li>
        <li>
          <strong>Technical &amp; Telemetry Data:</strong> Browser user-agent, operating system, IP address,
          session duration, device identifiers, and system error diagnostic reports.
        </li>
      </ul>

      <h2>3. How We Use Collected Data</h2>
      <p>We use your information strictly for the following operational purposes:</p>
      <ul>
        <li>Executing graph evaluations, multi-agent debate resolutions, and cloud-based backtest runs.</li>
        <li>Managing your account authentication, active sessions, and plan entitlements.</li>
        <li>Processing credit balances, subscription billing, and creator marketplace revenue payouts.</li>
        <li>Sending essential transactional notifications (e.g. backtest completion alerts, risk breach notices, password resets).</li>
        <li>Monitoring platform infrastructure stability, debugging software faults, and mitigating malicious abuse.</li>
      </ul>

      <h2>4. Data Storage, Security &amp; Retention</h2>
      <p>
        All communications with the Aether platform are encrypted in transit using industry-standard TLS 1.3
        cryptography. At-rest databases holding your bot graphs, credentials, and configuration settings are
        encrypted using AES-256 standards.
      </p>
      <p>
        We retain your account data and bot graph versions for as long as your account remains active. If you
        choose to delete your account, your bot graphs, configuration trees, API keys, and backtest histories
        are permanently expunged from our production databases within 30 days.
      </p>

      <h2>5. Data Portability &amp; The &ldquo;Export All Data&rdquo; Feature</h2>
      <p>
        You have complete ownership of your strategy architectures. In alignment with our commitment to data
        freedom, you can download a full archive of your account data at any time:
      </p>
      <p>
        From the workspace, navigate to <strong>Account &rarr; Danger Zone &rarr; Export all data</strong> to
        receive an instant, unencrypted JSON archive containing every bot graph, node configuration, canvas
        note, version snapshot, marketplace preset, backtest run log, and account preference. Backtest
        reports may also be individually exported in CSV or PDF formats directly from the backtest viewer.
      </p>

      <h2>6. Cookies &amp; Local Storage</h2>
      <p>
        We use essential browser cookies and local storage tokens strictly required for session management,
        theme preference persistence (light/dark/system mode), and canvas state caching. We do not deploy
        third-party advertising cookies or cross-site tracking pixels.
      </p>

      <h2>7. Children&rsquo;s Privacy</h2>
      <p>
        Aether is an algorithmic quantitative modeling tool designed exclusively for adults. We do not
        knowingly collect or solicit personal information from individuals under the age of 18. If we learn
        that an individual under 18 has registered an account, we will promptly terminate the account and
        delete their data.
      </p>

      <h2>8. Your Rights</h2>
      <p>
        Depending on your jurisdiction, you have the right to access, rectify, port, or request erasure of
        your personal data, as well as the right to withdraw consent for non-essential communications. To
        exercise these rights, you may utilize the in-app settings or contact our Data Protection Officer.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        If you have questions, concerns, or requests regarding this Privacy Policy or our security practices,
        please contact our privacy team at <a href="mailto:privacy@aether.dev">privacy@aether.dev</a>.
      </p>
    </LegalPageLayout>
  )
}
