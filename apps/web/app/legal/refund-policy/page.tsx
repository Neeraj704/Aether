import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Terms and eligibility for subscriptions, simulation credit purchases, and marketplace presets on Aether.',
}

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout title="Refund Policy" lastUpdated="24 August 2026">
      <p>
        At Aether Systems Pvt. Ltd. (&ldquo;Aether,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;), we aim to provide high-performance algorithmic modeling tools with clear,
        transparent pricing. This Refund Policy outlines the terms under which refunds may be granted for
        our recurring subscriptions, pay-as-you-go credit bundles, and marketplace purchases.
      </p>

      <h2>1. Recurring Subscriptions (Starter &amp; Pro)</h2>
      <p>
        We want you to be completely confident in your ability to build and test strategies on Aether:
      </p>
      <ul>
        <li>
          <strong>7-Day Initial Satisfaction Guarantee:</strong> If you purchase a new Starter or Pro
          subscription (or upgrade from a lower tier) and find that the platform does not meet your needs,
          you may request a full refund within <strong>7 calendar days</strong> of your initial purchase date.
        </li>
        <li>
          <strong>Usage Fair-Use Limitation:</strong> To protect our cloud compute infrastructure and market
          data licensing from automated harvesting, the 7-day refund guarantee is valid only if your account
          has executed fewer than <strong>15 historical or walk-forward backtests</strong> during that 7-day
          period.
        </li>
        <li>
          <strong>Subscription Renewals:</strong> Recurring monthly and annual subscriptions renew
          automatically at the start of each billing cycle. Renewals are <strong>non-refundable</strong> once
          billed. You can cancel your subscription at any time via <strong>Account &rarr; Billing</strong> to
          prevent future renewal charges; your tier entitlements will remain active until the end of your
          paid billing period.
        </li>
      </ul>

      <h2>2. Simulation Credit Purchases (Pay-as-you-go)</h2>
      <p>
        Aether offers pay-as-you-go credit bundles (such as 100, 500, or 1,000 credits) to unlock specific
        components permanently or run on-demand backtests:
      </p>
      <ul>
        <li>
          <strong>Spent / Consumed Credits:</strong> Once any credits from a purchased bundle have been
          expended to unlock a component node or run a backtest simulation, the bundle becomes{' '}
          <strong>non-refundable</strong>. This is because component unlocks remain permanently active on your
          account and simulation compute resources are consumed immediately.
        </li>
        <li>
          <strong>Unspent Credit Bundles:</strong> If you purchase a credit bundle and have not spent any of
          the associated credits, you may request a 100% refund within <strong>14 days</strong> of the
          transaction.
        </li>
        <li>
          <strong>No Expiration:</strong> Note that simulation credits on Aether <strong>never expire</strong>.
          There is no requirement to rush spending your credits, as they remain valid in your account balance
          indefinitely.
        </li>
      </ul>

      <h2>3. Marketplace Preset Purchases</h2>
      <p>
        The Aether Marketplace allows community creators to publish and sell custom bot graph presets and
        composite subgraphs:
      </p>
      <ul>
        <li>
          <strong>48-Hour Technical Defect Window:</strong> Because presets are instant digital goods that
          expose proprietary node configurations upon cloning, purchases of paid presets are generally final.
          However, if a purchased preset is demonstrably broken (e.g. missing required component connections
          or throwing persistent engine validation errors), you may request a refund within <strong>48 hours</strong> of purchase.
        </li>
        <li>
          <strong>Performance &amp; Trading Outcomes:</strong> Refunds will <strong>never</strong> be granted
          based on subsequent market trading losses, live performance disappointment, or poor backtest
          results on newly tested historical dates.
        </li>
      </ul>

      <h2>4. How to Request a Refund</h2>
      <p>
        To initiate a refund request, please contact our support team with the relevant transaction details:
      </p>
      <ol className="list-decimal pl-5 space-y-2 leading-6">
        <li>
          Send an email to <a href="mailto:support@aether.dev">support@aether.dev</a> or submit a ticket
          through our in-app help desk at <Link href="/app/help">Support</Link>.
        </li>
        <li>
          Include your registered account email address and your official transaction <strong>Invoice ID</strong> (for example, <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">INV-2026-0814</code>, which can be found under Account &rarr; Invoices or on your email receipt).
        </li>
        <li>Briefly state the reason for your refund request.</li>
      </ol>

      <h2>5. Processing &amp; Settlement Timeframes</h2>
      <p>
        Refund requests are reviewed by our operations team within <strong>1 to 2 business days</strong>.
        Once approved:
      </p>
      <ul>
        <li>
          Refunds are automatically issued back to your original payment method (Credit Card, Debit Card, or
          UPI).
        </li>
        <li>
          Depending on your card issuer or banking institution, funds typically reflect in your account within{' '}
          <strong>5 to 7 business days</strong>.
        </li>
      </ul>

      <h2>6. Chargebacks &amp; Payment Disputes</h2>
      <p>
        If you experience an unrecognized charge or billing discrepancy, we strongly encourage you to reach
        out to us first at <a href="mailto:support@aether.dev">support@aether.dev</a>. Filing an unverified
        chargeback without contacting support may result in immediate suspension of your account and bot
        execution privileges.
      </p>
    </LegalPageLayout>
  )
}
