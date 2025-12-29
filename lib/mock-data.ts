export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  tags: string[];
  description: string;
  shortDescription: string;
  inStock: boolean;
}

export const products: Product[] = [
  {
    id: "1",
    name: "Clinical Mad Honey 150gm",
    price: 65.0,
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/screencapture-mad-honey-store-shop-mad-honey-clinical-mad-honey-clinical-mad-honey-150gm-2025-10-17-23_13_42-yBDEdCHIu2LOUofXJtuTmGPKvG0JjH.png",
    category: "Clinical Mad Honey",
    tags: ["clinical", "organic"],
    shortDescription:
      "Premium clinical grade mad honey from the Himalayan foothills",
    description: `Clinical Mad Honey is harvested from the lower Himalayan foothills at altitudes ranging from 8,200 to 11,500 feet (2,500 to 3,500 meters).

It is recognized for its mildly potency along with sweet and enveloping taste. This variety is favored for its balanced effects, offering a gentle sense of relaxation and vitality and promoting relaxation.

Due to its spicier effect, Clinical mad honey can be consumed more frequently, making it ideal for beginners or those looking for a steady and manageable experience. It is primarily used for its medicinal benefits.`,
    inStock: true,
  },
  {
    id: "2",
    name: "Clinical Mad Honey 300gm",
    price: 119.0,
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/screencapture-mad-honey-store-shop-mad-honey-clinical-mad-honey-clinical-mad-honey-150gm-2025-10-17-23_13_42-yBDEdCHIu2LOUofXJtuTmGPKvG0JjH.png",
    category: "Clinical Mad Honey",
    tags: ["clinical", "organic"],
    shortDescription:
      "Premium clinical grade mad honey from the Himalayan foothills",
    description: `Clinical Mad Honey is harvested from the lower Himalayan foothills at altitudes ranging from 8,200 to 11,500 feet (2,500 to 3,500 meters).

It is recognized for its mildly potency along with sweet and enveloping taste. This variety is favored for its balanced effects, offering a gentle sense of relaxation and vitality and promoting relaxation.`,
    inStock: true,
  },
  {
    id: "3",
    name: "Clinical Mad Honey 600gm",
    price: 239.0,
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/screencapture-mad-honey-store-shop-mad-honey-clinical-mad-honey-clinical-mad-honey-150gm-2025-10-17-23_13_42-yBDEdCHIu2LOUofXJtuTmGPKvG0JjH.png",
    category: "Clinical Mad Honey",
    tags: ["clinical", "organic"],
    shortDescription:
      "Premium clinical grade mad honey from the Himalayan foothills",
    description: `Clinical Mad Honey is harvested from the lower Himalayan foothills at altitudes ranging from 8,200 to 11,500 feet (2,500 to 3,500 meters).

It is recognized for its mildly potency along with sweet and enveloping taste. This variety is favored for its balanced effects, offering a gentle sense of relaxation and vitality and promoting relaxation.`,
    inStock: true,
  },
  {
    id: "4",
    name: "Elite Mad Honey 150gm",
    price: 119.0,
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/screencapture-mad-honey-store-shop-mad-honey-clinical-mad-honey-clinical-mad-honey-150gm-2025-10-17-23_13_42-yBDEdCHIu2LOUofXJtuTmGPKvG0JjH.png",
    category: "Elite Mad Honey",
    tags: ["elite", "premium", "organic"],
    shortDescription: "Elite grade mad honey with enhanced potency",
    description: `Elite Mad Honey represents the pinnacle of mad honey quality, harvested from the highest altitudes of the Himalayan region.

This premium variety offers enhanced potency and a rich, complex flavor profile. Perfect for experienced users seeking the full benefits of authentic mad honey.`,
    inStock: true,
  },
  {
    id: "5",
    name: "Elite Mad Honey 300gm",
    price: 234.0,
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/screencapture-mad-honey-store-shop-mad-honey-clinical-mad-honey-clinical-mad-honey-150gm-2025-10-17-23_13_42-yBDEdCHIu2LOUofXJtuTmGPKvG0JjH.png",
    category: "Elite Mad Honey",
    tags: ["elite", "premium", "organic"],
    shortDescription: "Elite grade mad honey with enhanced potency",
    description: `Elite Mad Honey represents the pinnacle of mad honey quality, harvested from the highest altitudes of the Himalayan region.

This premium variety offers enhanced potency and a rich, complex flavor profile. Perfect for experienced users seeking the full benefits of authentic mad honey.`,
    inStock: true,
  },
  {
    id: "6",
    name: "Raw Mad Honey 250gm",
    price: 89.0,
    image:
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/screencapture-mad-honey-store-shop-mad-honey-clinical-mad-honey-clinical-mad-honey-150gm-2025-10-17-23_13_42-yBDEdCHIu2LOUofXJtuTmGPKvG0JjH.png",
    category: "Raw Mad Honey",
    tags: ["raw", "unprocessed", "organic"],
    shortDescription: "Unprocessed raw mad honey in its natural state",
    description: `Raw Mad Honey is completely unprocessed and unfiltered, maintaining all of its natural enzymes, pollen, and beneficial compounds.

This variety is perfect for those seeking the most authentic and natural mad honey experience, with all the traditional benefits preserved.`,
    inStock: true,
  },
];

export const relatedProducts: Product[] = products.slice(0, 4);
