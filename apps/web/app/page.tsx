import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { Hero } from '@/components/landing/hero'
import { StatsBar } from '@/components/landing/stats-bar'
import { FeatureGrid } from '@/components/landing/feature-grid'
import { HowItWorks } from '@/components/landing/how-it-works'
import { LayerShowcase } from '@/components/landing/layer-showcase'
import { MarketplaceTeaser } from '@/components/landing/marketplace-teaser'
import { PricingTeaser } from '@/components/landing/pricing-teaser'
import { Testimonials } from '@/components/landing/testimonials'
import { Faq } from '@/components/landing/faq'
import { ClosingCta } from '@/components/landing/closing-cta'

export default function HomePage() {
  return (
    <>
      <SiteNav />
      <main id="main">
        <Hero />
        <StatsBar />
        <FeatureGrid />
        <HowItWorks />
        <LayerShowcase />
        <MarketplaceTeaser />
        <PricingTeaser />
        <Testimonials />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  )
}
