// Mock data for homepage sections - will be replaced with DB data later

export interface HeroSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaLink: string;
  order: number;
  isActive: boolean;
}

export interface AboutSection {
  id: string;
  title: string;
  content: string;
  assetUrl: string;
  isActive: boolean;
}

export interface BenefitItem {
  icon: string;
  title: string;
  description: string;
}

export interface BenefitsSection {
  id: string;
  title: string;
  items: BenefitItem[];
  isActive: boolean;
}

// Mock hero slides
export const mockHeroSlides: HeroSlide[] = [
  {
    id: "1",
    imageUrl: "/golden-honey-jar-in-natural-mountain-setting-with-.jpg",
    title: "Pure Himalayan Mad Honey",
    subtitle: "Harvested from the highest peaks, delivered to your doorstep",
    ctaLabel: "Buy Now",
    ctaLink: "/products",
    order: 0,
    isActive: true,
  },
  {
    id: "2",
    imageUrl: "/organic-honey-with-honeycomb-and-bees-in-natural-e.jpg",
    title: "100% Organic & Natural",
    subtitle: "No additives, no preservatives, just pure honey",
    ctaLabel: "Buy Now",
    ctaLink: "/products",
    order: 1,
    isActive: true,
  },
  {
    id: "3",
    imageUrl: "/traditional-honey-harvesting-in-himalayan-mountain.jpg",
    title: "Traditionally Harvested",
    subtitle: "Supporting local beekeepers and sustainable practices",
    ctaLabel: "Buy Now",
    ctaLink: "/products",
    order: 2,
    isActive: true,
  },
];

// Mock about section
export const mockAboutSection: AboutSection = {
  id: "1",
  title: "Our Story",
  content:
    "For generations, our family has been harvesting the finest mad honey from the remote cliffs of the Himalayas. This rare and precious honey is collected from the nectar of rhododendron flowers that bloom at altitudes ranging from 8,200 to 11,500 feet. Our traditional harvesting methods ensure the highest quality while preserving the natural habitat and supporting local communities. Each jar represents a connection to ancient traditions and the pure essence of nature.",
  assetUrl: "/traditional-honey-harvesting-in-himalayan-mountain.jpg",
  isActive: true,
};

// Mock benefits section
export const mockBenefitsSection: BenefitsSection = {
  id: "1",
  title: "Why Choose Our Honey",
  items: [
    {
      icon: "leaf",
      title: "100% Pure & Natural",
      description:
        "Our honey is completely organic with no additives or preservatives. Harvested directly from pristine Himalayan forests.",
    },
    {
      icon: "heart",
      title: "Health Benefits",
      description:
        "Rich in antioxidants and natural compounds. Known for its unique properties and traditional medicinal uses.",
    },
    {
      icon: "users",
      title: "Supporting Communities",
      description:
        "Every purchase supports local beekeepers and their families, helping preserve traditional harvesting methods.",
    },
  ],
  isActive: true,
};
