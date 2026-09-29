import type { RAGDocument } from '../types/rag';

export const OFFICIAL_KNOWLEDGE_DOCUMENTS: RAGDocument[] = [
  {
    document_id: 'ndma-flood-guidelines-2023',
    title: 'NDMA Disaster Management Guidelines: Flood Safety & Urban Inundation',
    source: 'National Disaster Management Guidelines',
    organization: 'National Disaster Management Authority (NDMA)',
    url: 'https://ndma.gov.in/Natural-Hazards/Floods',
    category: 'flood_preparedness',
    publication_date: '2023-04-15',
    retrieved_at: '2026-09-29T00:00:00Z',
    content: `
BEFORE A FLOOD:
1. Know the flood risk in your area, evacuation routes, and community shelter locations.
2. Assemble an emergency survival kit containing non-perishable food, potable drinking water (3 liters/person/day), battery-powered radio, torches, spare batteries, first aid kit, essential medications, and waterproof document pouches.
3. Keep emergency numbers (112, 1070 for State Emergency Operation Centers, 1077 for District Emergency Operation Centers) readily accessible.
4. Elevate critical electrical appliances and household circuit breakers above historical flood levels.
5. Clear local drains and drainage channels around dwelling structures to prevent localized water stagnation.

DURING A FLOOD:
1. Move immediately to designated higher ground or elevated concrete structures if advised by local administration.
2. DO NOT walk, swim, or drive through moving flood waters. As little as 15 cm (6 inches) of moving water can knock down an adult, and 30 to 60 cm (1-2 feet) of water can float most passenger vehicles.
3. Switch off main electricity breakers and gas supplies before evacuating or if water enters premises. Never touch wet electrical switches or fallen power lines.
4. Do not drink untreated flood water. Use boiled water, chlorine tablets, or sealed bottled water to prevent waterborne diseases like cholera, typhoid, and leptospirosis.
5. Follow instructions broadcasted through All India Radio, official Doordarshan channels, and state disaster relief mobile alerts.

AFTER A FLOOD:
1. Return home only after local authorities declare the area safe.
2. Inspect buildings for structural damage, foundation cracks, gas leaks, and live electrical wiring before entering.
3. Disinfect all items, floors, and utensils contaminated by flood water.
4. Watch out for snakes, insects, and stray animals seeking shelter in high dry corners of flooded houses.
    `.trim(),
    metadata: {
      hazard: 'Floods',
      jurisdiction: 'India',
      official_status: 'Government Standard Operating Procedure',
    },
  },
  {
    document_id: 'ndma-cyclone-sop-2023',
    title: 'NDMA Standard Operating Procedure: Cyclone Preparedness & Coastal Evacuation',
    source: 'NDMA Cyclone Safety Manual',
    organization: 'National Disaster Management Authority (NDMA)',
    url: 'https://ndma.gov.in/Natural-Hazards/Cyclones',
    category: 'cyclone_preparedness',
    publication_date: '2023-05-10',
    retrieved_at: '2026-09-29T00:00:00Z',
    content: `
PRE-CYCLONE PREPAREDNESS:
1. Check the building roof and secure loose tiles, asbestos sheets, or tin roofs. Trim overhanging tree branches close to houses and power cables.
2. Keep battery-operated transistor radios tuned to IMD coastal weather bulletins and cyclone tracking bulletins.
3. Ensure mobile phones, power banks, and rechargeable emergency lamps are fully charged well ahead of landfall.
4. Fishermen must strictly heed IMD advisories and avoid venturing into the open sea during depression or cyclone alerts. Keep fishing boats securely anchored.
5. Move cattle and domestic animals to higher sheltered sheds away from coastal surge zones.

DURING CYCLONE PASSAGE:
1. Remain indoors in the safest, central interior room of the house, away from glass windows and doors.
2. Close and secure all doors and windows. Draw curtains to prevent flying glass shards if windows shatter.
3. Turn off main electrical switches and gas cylinders.
4. If the storm suddenly subsides, DO NOT step outdoors immediately. The lull may be the 'Eye of the Cyclone', which will be followed by violent reverse-direction winds of equal or higher intensity.
5. Avoid spreading rumors or unverified social media audio clips. Rely exclusively on official IMD/NDMA bulletins.
    `.trim(),
    metadata: {
      hazard: 'Cyclones',
      jurisdiction: 'India',
      official_status: 'Government Standard Operating Procedure',
    },
  },
  {
    document_id: 'ndma-heatwave-action-plan-2024',
    title: 'NDMA National Guidelines for Preparation of Action Plan - Prevention and Management of Heatwave',
    source: 'National Heatwave Guidelines',
    organization: 'National Disaster Management Authority (NDMA)',
    url: 'https://ndma.gov.in/Natural-Hazards/Heat-Wave',
    category: 'heatwave_safety',
    publication_date: '2024-03-20',
    retrieved_at: '2026-09-29T00:00:00Z',
    content: `
HEATWAVE PRECAUTIONARY MEASURES:
1. Avoid going out in direct sunlight during peak temperature hours, particularly between 12:00 Noon and 3:00 PM.
2. Drink sufficient water as often as possible, even if not feeling thirsty. Carry drinking water when traveling.
3. Consume traditional hydrating liquids like Oral Rehydration Solution (ORS), coconut water, buttermilk (chaas), lemon water (nimbu pani), and raw mango cooler (aam panna).
4. Wear lightweight, light-colored, loose, and porous cotton clothes. Use sunglasses, umbrellas, hats, and footwear when venturing outdoors.
5. Never leave children, elderly persons, or pets unattended in parked vehicles, where cabin temperatures can reach fatal levels in minutes.

SYMPTOMS OF HEAT ILLNESS & FIRST AID:
- Heat Exhaustion: Heavy sweating, weakness, cold pale clammy skin, fast weak pulse, nausea, dizziness. First Aid: Move person to shaded cool room, loosen clothing, provide small sips of water.
- Heat Stroke (Medical Emergency): Body temperature above 40°C (104°F), hot red dry skin (no sweating), rapid strong pulse, confusion, unconsciousness. Call 108 immediately. Sponge body with cool water while waiting for medical assistance.
    `.trim(),
    metadata: {
      hazard: 'Heatwave',
      jurisdiction: 'India',
      official_status: 'National Health Guidelines',
    },
  },
  {
    document_id: 'imd-weather-terminology-2023',
    title: 'IMD Weather Forecasting Terminology and Rainfall Classification Criteria',
    source: 'IMD Meteorological Glossary & Observation Standards',
    organization: 'India Meteorological Department (IMD)',
    url: 'https://mausam.imd.gov.in',
    category: 'meteorological_concepts',
    publication_date: '2023-01-10',
    retrieved_at: '2026-09-29T00:00:00Z',
    content: `
IMD 24-HOUR RAINFALL CLASSIFICATION SCALE:
1. Very Light Rain: 0.1 to 2.4 mm in 24 hours.
2. Light Rain: 2.5 to 15.5 mm in 24 hours.
3. Moderate Rain: 15.6 to 64.4 mm in 24 hours.
4. Heavy Rain: 64.5 to 115.5 mm in 24 hours (triggers alert status).
5. Very Heavy Rain: 115.6 to 204.4 mm in 24 hours (triggers localized inundation warnings).
6. Extremely Heavy Rain: 204.5 mm or more in 24 hours (severe flood hazard).

METEOROLOGICAL TERMINOLOGY:
- Relative Humidity (%): Ratio of water vapor present in the air to the maximum amount of water vapor the air can hold at the same temperature and pressure. When humidity reaches 90-100%, evaporation of sweat diminishes, significantly increasing the 'Feels Like' heat index.
- Atmospheric Pressure (hPa/mb): Weight of air per unit area. Normal sea-level pressure is approx 1013.25 hPa. A rapid drop in barometric pressure signals approaching convective storms, depressions, or cyclones.
- Wind Gusts vs Sustained Wind: Sustained wind speed is the average wind measured over a standard 10-minute interval. Gusts are brief, rapid bursts of wind lasting 3-5 seconds that can exceed sustained speeds by 30-50%.
    `.trim(),
    metadata: {
      topic: 'Meteorology',
      jurisdiction: 'India',
      official_status: 'Standard Scientific Criteria',
    },
  },
  {
    document_id: 'imd-warning-color-matrix-2023',
    title: 'IMD Standard Operating Procedure: 4-Stage Colour-Coded Weather Warning Matrix',
    source: 'IMD Weather Warning SOP',
    organization: 'India Meteorological Department (IMD)',
    url: 'https://mausam.imd.gov.in',
    category: 'official_advisories',
    publication_date: '2023-02-15',
    retrieved_at: '2026-09-29T00:00:00Z',
    content: `
IMD 4-STAGE COLOUR CODE MATRIX:
IMD uses a 4-colour warning scale to alert state disaster management agencies and the general public:

1. GREEN (No Warning):
   - Meaning: No severe weather anticipated.
   - Action Required: No action required. Continue normal daily routine.

2. YELLOW (Be Updated):
   - Meaning: Weather conditions are bad or worsening; potential for isolated localized hazards.
   - Action Required: Stay updated with daily local weather forecasts and advisories.

3. ORANGE (Be Prepared):
   - Meaning: Weather conditions are very likely to cause severe disruptions in daily life, transport, power, and low-lying inundation.
   - Action Required: Be prepared. Secure loose objects, avoid travel in flood-prone corridors, keep backup power and emergency kits accessible.

4. RED (Take Action):
   - Meaning: Extremely bad weather with very high probability of extensive damage, threat to life and critical infrastructure, widespread inundation.
   - Action Required: Take immediate action. Follow evacuation orders from district collector and disaster administration. Avoid all non-essential movement.
    `.trim(),
    metadata: {
      topic: 'Warnings',
      jurisdiction: 'India',
      official_status: 'National Early Warning Protocol',
    },
  },
  {
    document_id: 'ndma-emergency-kit-checklist-2024',
    title: 'NDMA Citizen Emergency Survival Kit & Family Preparedness Checklist',
    source: 'NDMA Citizen Preparedness Guidelines',
    organization: 'National Disaster Management Authority (NDMA)',
    url: 'https://ndma.gov.in',
    category: 'emergency_preparedness',
    publication_date: '2024-01-05',
    retrieved_at: '2026-09-29T00:00:00Z',
    content: `
ESSENTIAL 72-HOUR DISASTER SURVIVAL KIT:
Every household in disaster-prone regions should keep a ready backpack containing:
1. Water: At least 3 liters of water per person per day for drinking and basic sanitation.
2. Food: 3-day supply of non-perishable, ready-to-eat foods (dry fruits, roasted grams, energy biscuits, canned foods with manual opener).
3. First Aid Kit: Antiseptic lotion, adhesive bandages, sterile gauze, burn cream, paracetamol, ORS packets, and a minimum 7-day reserve of prescription medicines.
4. Tools & Lighting: High-intensity LED flashlight, spare batteries, battery-powered or hand-crank AM/FM radio, whistle (to signal rescue personnel under debris or through fog), multi-tool pocket knife.
5. Documents & Cash: Waterproof sealed pouch containing photocopies of Aadhaar cards, voter IDs, property papers, insurance policies, medical records, and adequate emergency cash in small denominations (ATMs cease functioning during power outages).
6. Hygiene & Sanitation: Soap, hand sanitizer, sanitary pads, chlorine tablets, moist towelettes, and heavy-duty garbage bags.
7. Thermal Protection: Lightweight raincoats, thermal foil emergency blankets, and a change of sturdy clothes.
    `.trim(),
    metadata: {
      topic: 'Preparedness',
      jurisdiction: 'India',
      official_status: 'Official Family Preparedness Checklist',
    },
  },
];
