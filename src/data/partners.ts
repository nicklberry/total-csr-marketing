export interface PartnerData {
  slug: string;
  partnerName: string;
  partnerType: 'association' | 'aggregator' | 'carrier' | 'vendor';
  eyebrow: string;
  headline: string;
  subheadline: string;
  discountNote?: string;
  logoUrl?: string;
  ctaLabel: string;
  talkingPoints: string[];
  testimonial?: {
    quote: string;
    name: string;
    title: string;
    agency: string;
  };
  metaTitle: string;
  metaDescription: string;
  active: boolean;
}

export const partners: PartnerData[] = [
  {
    slug: 'iiaba-members',
    partnerName: 'IIABA',
    partnerType: 'association',
    eyebrow: 'IIABA Member Benefit',
    headline: 'Training built for independent agencies. A discount built for IIABA members.',
    subheadline: 'Total CSR is the training platform built exclusively for independent P&C agencies. IIABA members receive 15% off.',
    discountNote: 'IIABA members receive 15% off annual platform pricing.',
    ctaLabel: 'Claim your member discount',
    talkingPoints: [
      'Hire, Assess, Train, Retain, LicenseTraq, CE, and Ask Ellie in one platform',
      '15% member discount applied at checkout',
      'CE approved in most states',
      'Built for P&C agencies, not generic SaaS',
    ],
    metaTitle: 'IIABA Member Discount | Total CSR Training Platform',
    metaDescription: 'IIABA members receive 15% off Total CSR, the training and hiring platform built exclusively for independent P&C agencies.',
    active: true,
  },
];
