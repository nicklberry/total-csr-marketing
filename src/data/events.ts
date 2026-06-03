export interface EventData {
  slug: string;
  title: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  date: string;
  location: string;
  venueName?: string;
  boothNumber?: string;
  ctaLabel: string;
  talkingPoints: string[];
  metaTitle: string;
  metaDescription: string;
  active: boolean;
}

export const events: EventData[] = [
  {
    slug: 'iiaba-2026',
    title: 'IIABA Annual Conference 2026',
    eyebrow: 'IIABA Annual Conference',
    headline: 'Meet the Total CSR team in Nashville.',
    subheadline: 'We will be at IIABA this September. If your agency is dealing with training gaps, turnover, or E&O exposure, this is a 20-minute conversation worth having.',
    date: 'September 15-17, 2026',
    location: 'Nashville, TN',
    venueName: 'Gaylord Opryland Resort',
    boothNumber: 'Booth 412',
    ctaLabel: 'Schedule time with us',
    talkingPoints: [
      'See the full platform in 20 minutes',
      'Hire, Assess, Train, Retain, LicenseTraq, CE, and Ask Ellie',
      'Built exclusively for independent P&C agencies',
      'Live demo with your agency\'s actual pain points',
    ],
    metaTitle: 'Meet Total CSR at IIABA 2026 | Nashville',
    metaDescription: 'Total CSR will be at IIABA Annual Conference in Nashville. Schedule time to see how independent agencies hire, train, and retain better staff.',
    active: true,
  },
];
