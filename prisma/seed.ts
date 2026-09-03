import "dotenv/config";
import prisma from "../src/config/database";
import { CategoryType } from "../src/generated/prisma/enums";

const DEFAULT_CATEGORIES = [
  // Service Categories
  { name: "RO & Water Purifier", slug: "ro-water-purifier", type: CategoryType.SERVICE, icon: "Droplets", description: "Water purification system repair, filter replacement, installation & AMC." },
  { name: "Inverter / Split AC", slug: "inverter-split-ac", type: CategoryType.SERVICE, icon: "AirVent", description: "Air conditioning servicing, gas charging, installation & repair." },
  { name: "Storage & Instant Geyser", slug: "storage-instant-geyser", type: CategoryType.SERVICE, icon: "Flame", description: "Water heater repair, thermostat replacement & descaling." },
  { name: "Frost-Free Refrigerator", slug: "frost-free-refrigerator", type: CategoryType.SERVICE, icon: "Refrigerator", description: "Single and double door refrigerator cooling repair & gas refilling." },
  { name: "AMC Comprehensive Plans", slug: "amc-comprehensive-plans", type: CategoryType.SERVICE, icon: "ShieldCheck", description: "Annual maintenance contracts with unlimited service visits & free filter replacement." },
  { name: "Chimney & Kitchen Hood", slug: "chimney-kitchen-hood", type: CategoryType.SERVICE, icon: "Wind", description: "Kitchen chimney deep cleaning, ducting & motor repairs." },
  { name: "Solar Water Heater", slug: "solar-water-heater", type: CategoryType.SERVICE, icon: "Sun", description: "Solar heating panel maintenance, plumbing & tank cleaning." },
  { name: "Other Household Appliance", slug: "other-household-appliance", type: CategoryType.SERVICE, icon: "Wrench", description: "General electrical and home appliance repair services." },

  // Product Categories
  { name: "RO Water Purifiers", slug: "ro-water-purifiers-prod", type: CategoryType.PRODUCT, icon: "Droplet", description: "Domestic and commercial RO purification units." },
  { name: "RO Filters & Cartridges", slug: "ro-filters-cartridges", type: CategoryType.PRODUCT, icon: "Layers", description: "Sediment filters, carbon blocks, membrane & UV lamp spares." },
  { name: "AC Spare Parts", slug: "ac-spare-parts", type: CategoryType.PRODUCT, icon: "Fan", description: "Capacitors, copper pipes, fan motors & compressor spares." },
  { name: "Geyser Elements & Spares", slug: "geyser-elements-spares", type: CategoryType.PRODUCT, icon: "Zap", description: "Heating coils, thermostats & safety valves." },
  { name: "General Tools & Hardware", slug: "general-tools-hardware", type: CategoryType.PRODUCT, icon: "Tool", description: "Professional technician tooling & installation hardware." },
];

async function main() {
  console.log("Seeding default dynamic categories...");
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        description: cat.description,
        isActive: true,
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        type: cat.type,
        icon: cat.icon,
        description: cat.description,
        isActive: true,
      },
    });
  }
  console.log("Categories seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
