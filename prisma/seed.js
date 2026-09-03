"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../src/generated/prisma/client");
const enums_1 = require("../src/generated/prisma/enums");
const prisma = new client_1.PrismaClient();
const DEFAULT_CATEGORIES = [
    // Service Categories
    { name: "RO & Water Purifier", slug: "ro-water-purifier", type: enums_1.CategoryType.SERVICE, icon: "Droplets", description: "Water purification system repair, filter replacement, installation & AMC." },
    { name: "Inverter / Split AC", slug: "inverter-split-ac", type: enums_1.CategoryType.SERVICE, icon: "AirVent", description: "Air conditioning servicing, gas charging, installation & repair." },
    { name: "Storage & Instant Geyser", slug: "storage-instant-geyser", type: enums_1.CategoryType.SERVICE, icon: "Flame", description: "Water heater repair, thermostat replacement & descaling." },
    { name: "Frost-Free Refrigerator", slug: "frost-free-refrigerator", type: enums_1.CategoryType.SERVICE, icon: "Refrigerator", description: "Single and double door refrigerator cooling repair & gas refilling." },
    { name: "AMC Comprehensive Plans", slug: "amc-comprehensive-plans", type: enums_1.CategoryType.SERVICE, icon: "ShieldCheck", description: "Annual maintenance contracts with unlimited service visits & free filter replacement." },
    { name: "Chimney & Kitchen Hood", slug: "chimney-kitchen-hood", type: enums_1.CategoryType.SERVICE, icon: "Wind", description: "Kitchen chimney deep cleaning, ducting & motor repairs." },
    { name: "Solar Water Heater", slug: "solar-water-heater", type: enums_1.CategoryType.SERVICE, icon: "Sun", description: "Solar heating panel maintenance, plumbing & tank cleaning." },
    { name: "Other Household Appliance", slug: "other-household-appliance", type: enums_1.CategoryType.SERVICE, icon: "Wrench", description: "General electrical and home appliance repair services." },
    // Product Categories
    { name: "RO Water Purifiers", slug: "ro-water-purifiers-prod", type: enums_1.CategoryType.PRODUCT, icon: "Droplet", description: "Domestic and commercial RO purification units." },
    { name: "RO Filters & Cartridges", slug: "ro-filters-cartridges", type: enums_1.CategoryType.PRODUCT, icon: "Layers", description: "Sediment filters, carbon blocks, membrane & UV lamp spares." },
    { name: "AC Spare Parts", slug: "ac-spare-parts", type: enums_1.CategoryType.PRODUCT, icon: "Fan", description: "Capacitors, copper pipes, fan motors & compressor spares." },
    { name: "Geyser Elements & Spares", slug: "geyser-elements-spares", type: enums_1.CategoryType.PRODUCT, icon: "Zap", description: "Heating coils, thermostats & safety valves." },
    { name: "General Tools & Hardware", slug: "general-tools-hardware", type: enums_1.CategoryType.PRODUCT, icon: "Tool", description: "Professional technician tooling & installation hardware." },
];
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Seeding default dynamic categories...");
        for (const cat of DEFAULT_CATEGORIES) {
            yield prisma.category.upsert({
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
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
