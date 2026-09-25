"""
Bulk-seed category -> subcategory -> sub-subcategory -> brands.

Idempotent: matches existing rows by slug and updates them in place,
so this is safe to re-run after editing HIERARCHY.

Usage:
    python3 seed_category_hierarchy.py            # prints a plan, asks to confirm
    python3 seed_category_hierarchy.py --yes       # skips the confirmation prompt
    python3 seed_category_hierarchy.py --dry-run   # prints the plan and exits, no writes
"""
import argparse
import sys
from typing import Optional

from sqlmodel import Session, select

from app.db.session import engine
from app.models.listing import Category, SubSubCategory
from app.models.subcategory import Subcategory
from app.core.config import settings


# Edit this to describe what you want seeded. Any field left out of an
# existing row is left untouched -- only the fields you provide are written.
#
# Subcategories below reuse the *existing* slugs where the new name is a
# rename/expansion of something that already exists, so they update in
# place rather than creating duplicates. Genuinely new subcategories get
# new slugs.
#
# Fashion notes:
# - "Watches & Sunglasses" (old combined subcategory) is split: "Watches"
#   reuses its slug, "Sunglasses & Eyewear" is new.
# - "Clothing Accessories" is reused by "Fashion Accessories".
# - Items repeated verbatim across multiple subcategories in the source
#   list (T-Shirts/Jackets/Trousers/Jeans/etc. under both Men's and
#   Women's Clothing) are gender-suffixed in the slug (t-shirts-men vs
#   t-shirts-women) so they don't collide and silently reassign parent.
# - Traditional-wear items (Thobes, Abayas, Hijabs, etc.) that were listed
#   both inline under Men's/Women's Clothing AND under the new dedicated
#   "Traditional & Cultural Wear" subcategory are consolidated there only.
# - "Leggings" stays under Women's Clothing; Sportswear's version is
#   "Sports Leggings". "School Uniforms" stays under Children's Clothing
#   only (removed from Workwear & Uniforms).
HIERARCHY = [
    {
        "name_en": "Vehicles",
        "slug": "vehicles",
        "subcategories": [
            {
                "name_en": "Cars",
                "slug": "cars",  # reuse
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Toyota", "Nissan", "Honda", "Mazda", "Subaru", "Mitsubishi", "Suzuki", "Isuzu", "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Volvo", "Ford", "Chevrolet", "Hyundai", "Kia", "Land Rover", "Jeep", "Lexus", "Peugeot", "Renault", "Skoda", "Tesla", "Porsche", "Jaguar", "Bentley", "Range Rover", "Other Brands"]}
                    for n, s in [
                        ("Sedans", "sedans"), ("Hatchbacks", "hatchbacks"),
                        ("Station Wagons", "station-wagons"), ("SUVs", "suvs"),
                        ("Crossovers", "crossovers"), ("Coupes", "coupes"),
                        ("Convertibles", "convertibles"), ("Pickup Trucks", "pickup-trucks"),
                        ("Minivans", "minivans"), ("MPVs", "mpvs"), ("Luxury Cars", "luxury-cars"),
                        ("Sports Cars", "sports-cars"), ("Classic Cars", "classic-cars"),
                        ("Vintage Cars", "vintage-cars"), ("Limousines", "limousines"),
                        ("Taxi Cars", "taxi-cars"), ("Used Cars", "used-cars"), ("New Cars", "new-cars"),
                    ]
                ],
            },
            {
                "name_en": "Motorcycles",
                "slug": "motorcycles",  # reuse
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Honda", "Yamaha", "Suzuki", "Kawasaki", "KTM", "Bajaj", "TVS", "Boxer", "Royal Enfield", "Harley-Davidson", "BMW Motorrad", "Ducati", "Triumph", "Aprilia", "Vespa", "Piaggio", "Haojue", "Hero", "CFMoto", "Other Brands"]}
                    for n, s in [
                        ("Standard Motorcycles", "standard-motorcycles"),
                        ("Sport Motorcycles", "sport-motorcycles"),
                        ("Cruiser Motorcycles", "cruiser-motorcycles"),
                        ("Touring Motorcycles", "touring-motorcycles"),
                        ("Adventure Motorcycles", "adventure-motorcycles"),
                        ("Enduro Motorcycles", "enduro-motorcycles"),
                        ("Motocross Motorcycles", "motocross-motorcycles"),
                        ("Dual Sport Motorcycles", "dual-sport-motorcycles"), ("Scooters", "scooters"),
                        ("Tricycles", "tricycles"), ("Three-Wheel Motorcycles", "three-wheel-motorcycles"),
                        ("Delivery Motorcycles", "delivery-motorcycles"),
                        ("Off-Road Motorcycles", "off-road-motorcycles"),
                        ("Motorcycle Sidecars", "motorcycle-sidecars"),
                        ("Used Motorcycles", "used-motorcycles"), ("New Motorcycles", "new-motorcycles"),
                    ]
                ],
            },
            {
                "name_en": "Commercial Vehicles",
                "slug": "trucks-and-buses",  # reuse
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Isuzu", "Toyota", "Mitsubishi", "Hino", "Fuso", "Scania", "Volvo", "MAN", "Mercedes-Benz", "DAF", "Iveco", "Ford", "Tata", "Ashok Leyland", "Sinotruk", "FAW", "UD Trucks", "Renault Trucks", "Other Brands"]}
                    for n, s in [
                        ("Panel Vans", "panel-vans"), ("Cargo Vans", "cargo-vans"),
                        ("Delivery Vans", "delivery-vans"), ("Passenger Buses", "passenger-buses"),
                        ("Coaches", "coaches"), ("Light Trucks", "light-trucks"),
                        ("Medium Trucks", "medium-trucks"), ("Heavy Trucks", "heavy-trucks"),
                        ("Box Trucks", "box-trucks"), ("Car Carrier Trucks", "car-carrier-trucks"),
                        ("Garbage Trucks", "garbage-trucks"), ("Fire Trucks", "fire-trucks"),
                        ("Ambulances", "ambulances"),
                    ]
                ],
            },
            {
                "name_en": "Buses & Public Transport",
                "slug": "buses-public-transport",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Isuzu", "Toyota", "Hino", "Fuso", "Mercedes-Benz", "Scania", "Volvo", "MAN", "Yutong", "Tata", "Ashok Leyland", "King Long", "Other Brands"]}
                    for n, s in [
                        ("City Buses", "city-buses"), ("School Buses", "school-buses"),
                        ("Tour Buses", "tour-buses"), ("Luxury Coaches", "luxury-coaches"),
                        ("Minibuses", "minibuses"), ("Matatus", "matatus"),
                        ("Shuttle Buses", "shuttle-buses"), ("Staff Buses", "staff-buses"),
                        ("Passenger Vans", "passenger-vans"), ("Airport Buses", "airport-buses"),
                        ("Double Decker Buses", "double-decker-buses"), ("Used Buses", "used-buses"),
                        ("New Buses", "new-buses"),
                    ]
                ],
            },
            {
                "name_en": "Trucks & Trailers",
                "slug": "trucks-trailers",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Scania", "Volvo", "MAN", "Mercedes-Benz", "DAF", "Iveco", "Isuzu", "Hino", "Fuso", "Sinotruk", "FAW", "Tata", "UD Trucks", "Other Brands"]}
                    for n, s in [
                        ("Cargo Trucks", "cargo-trucks"), ("Tipper Trucks", "tipper-trucks"),
                        ("Flatbed Trucks", "flatbed-trucks"), ("Tanker Trucks", "tanker-trucks"),
                        ("Refrigerated Trucks", "refrigerated-trucks"),
                        ("Container Trucks", "container-trucks"), ("Dump Trucks", "dump-trucks"),
                        ("Crane Trucks", "crane-trucks"), ("Tow Trucks", "tow-trucks"),
                        ("Logging Trucks", "logging-trucks"), ("Heavy Duty Trucks", "heavy-duty-trucks"),
                        ("Light Duty Trucks", "light-duty-trucks"), ("Semi Trailers", "semi-trailers"),
                        ("Flatbed Trailers", "flatbed-trailers"), ("Box Trailers", "box-trailers"),
                        ("Tanker Trailers", "tanker-trailers"), ("Car Trailers", "car-trailers"),
                        ("Livestock Trailers", "livestock-trailers"),
                        ("Utility Trailers", "utility-trailers"),
                        ("Refrigerated Trailers", "refrigerated-trailers"),
                    ]
                ],
            },
            {
                "name_en": "Agricultural Vehicles & Machinery",
                "slug": "agricultural-vehicles-machinery",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["John Deere", "Massey Ferguson", "New Holland", "Case IH", "Kubota", "Mahindra", "Fendt", "Deutz-Fahr", "Ford", "Yanmar", "TAFE", "Same", "Other Brands"]}
                    for n, s in [
                        ("Tractors", "tractors"), ("Mini Tractors", "mini-tractors"),
                        ("Farm Tractors", "farm-tractors"), ("Tractor Attachments", "tractor-attachments"),
                        ("Combine Harvesters", "combine-harvesters"),
                        ("Harvesting Machines", "harvesting-machines"),
                        ("Planting Machines", "planting-machines"), ("Seeders", "seeders"),
                        ("Sprayers", "sprayers"), ("Ploughs", "ploughs"), ("Harrows", "harrows"),
                        ("Cultivators", "cultivators"), ("Irrigation Equipment", "irrigation-equipment"),
                        ("Farm Trailers", "farm-trailers"), ("Hay Balers", "hay-balers"),
                        ("Mowers", "mowers"), ("Threshers", "threshers"),
                        ("Agricultural Loaders", "agricultural-loaders"),
                        ("Agricultural Utility Vehicles", "agricultural-utility-vehicles"),
                    ]
                ],
            },
            {
                "name_en": "Construction & Heavy Machinery",
                "slug": "construction-heavy-machinery",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Caterpillar", "Komatsu", "JCB", "Volvo", "Hitachi", "Hyundai", "Doosan", "Liebherr", "John Deere", "CASE", "Kobelco", "SANY", "XCMG", "Shantui", "Other Brands"]}
                    for n, s in [
                        ("Excavators", "excavators"), ("Mini Excavators", "mini-excavators"),
                        ("Wheel Loaders", "wheel-loaders"), ("Bulldozers", "bulldozers"),
                        ("Backhoe Loaders", "backhoe-loaders"), ("Motor Graders", "motor-graders"),
                        ("Skid Steer Loaders", "skid-steer-loaders"), ("Forklifts", "forklifts"),
                        ("Cranes", "cranes"), ("Mobile Cranes", "mobile-cranes"),
                        ("Tower Cranes", "tower-cranes"), ("Road Rollers", "road-rollers"),
                        ("Asphalt Pavers", "asphalt-pavers"), ("Concrete Mixers", "concrete-mixers"),
                        ("Concrete Pumps", "concrete-pumps"), ("Dumpers", "dumpers"),
                        ("Drilling Machines", "drilling-machines"), ("Compactors", "compactors"),
                        ("Construction Trailers", "construction-trailers"),
                    ]
                ],
            },
            {
                "name_en": "Watercraft & Marine Vehicles",
                "slug": "watercraft-marine-vehicles",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Yamaha Marine", "Honda Marine", "Suzuki Marine", "Mercury", "Sea-Doo", "Kawasaki", "Bayliner", "Boston Whaler", "Beneteau", "Jeanneau", "Other Brands"]}
                    for n, s in [
                        ("Motorboats", "motorboats"), ("Speedboats", "speedboats"),
                        ("Fishing Boats", "fishing-boats"), ("Sailboats", "sailboats"),
                        ("Yachts", "yachts"), ("Jet Skis", "jet-skis"), ("Canoes", "canoes"),
                        ("Kayaks", "kayaks"), ("Inflatable Boats", "inflatable-boats"),
                        ("Catamarans", "catamarans"), ("Houseboats", "houseboats"),
                        ("Commercial Boats", "commercial-boats"), ("Marine Engines", "marine-engines"),
                        ("Boat Trailers", "boat-trailers"),
                    ]
                ],
            },
            {
                "name_en": "Electric & Hybrid Vehicles",
                "slug": "electric-hybrid-vehicles",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Tesla", "BYD", "Nissan", "Hyundai", "Kia", "Toyota", "BMW", "Mercedes-Benz", "Volkswagen", "Volvo", "MG", "Polestar", "Ora", "Other Brands"]}
                    for n, s in [
                        ("Electric Cars", "electric-cars"), ("Hybrid Cars", "hybrid-cars"),
                        ("Plug-In Hybrid Cars", "plug-in-hybrid-cars"), ("Electric SUVs", "electric-suvs"),
                        ("Electric Motorcycles", "electric-motorcycles"),
                        ("Electric Scooters", "electric-scooters"),
                        ("Electric Bicycles", "electric-bicycles"), ("Electric Vans", "electric-vans"),
                        ("Electric Trucks", "electric-trucks"), ("Electric Buses", "electric-buses"),
                        ("EV Charging Stations", "ev-charging-stations"), ("EV Chargers", "ev-chargers"),
                        ("EV Accessories", "ev-accessories"),
                    ]
                ],
            },
            {
                "name_en": "Vehicle Spare Parts",
                "slug": "vehicle-parts-and-accessories",  # reuse
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Toyota", "Nissan", "Honda", "Mazda", "Subaru", "Mitsubishi", "Isuzu", "Mercedes-Benz", "BMW", "Volkswagen", "Bosch", "Denso", "NGK", "SKF", "Gates", "Mann-Filter", "Other Brands"]}
                    for n, s in [
                        ("Engine Parts", "engine-parts"), ("Engine Blocks", "engine-blocks"),
                        ("Pistons", "pistons"), ("Piston Rings", "piston-rings"),
                        ("Cylinder Heads", "cylinder-heads"), ("Gaskets", "gaskets"),
                        ("Timing Belts", "timing-belts"), ("Timing Chains", "timing-chains"),
                        ("Radiators", "radiators"), ("Water Pumps", "water-pumps"),
                        ("Fuel Pumps", "fuel-pumps"), ("Oil Pumps", "oil-pumps"),
                        ("Turbochargers", "turbochargers"), ("Clutches", "clutches"),
                        ("Gearbox Parts", "gearbox-parts"), ("Transmission Parts", "transmission-parts"),
                        ("Exhaust Parts", "exhaust-parts"),
                        ("Catalytic Converters", "catalytic-converters"),
                        ("Suspension Parts", "suspension-parts"), ("Shock Absorbers", "shock-absorbers"),
                        ("Steering Parts", "steering-parts"), ("Brake Parts", "brake-parts"),
                        ("Brake Pads", "brake-pads"), ("Brake Discs", "brake-discs"),
                        ("Wheel Bearings", "wheel-bearings"), ("Electrical Parts", "electrical-parts"),
                        ("Sensors", "sensors-vehicle"), ("Vehicle Batteries", "vehicle-batteries-parts"),
                        ("Filters", "filters"), ("Air Filters", "air-filters"),
                        ("Oil Filters", "oil-filters"), ("Fuel Filters", "fuel-filters"),
                        ("Spark Plugs", "spark-plugs"), ("Glow Plugs", "glow-plugs"),
                    ]
                ],
            },
            {
                "name_en": "Tyres & Wheels",
                "slug": "tyres-wheels",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Michelin", "Bridgestone", "Goodyear", "Continental", "Pirelli", "Yokohama", "Dunlop", "Hankook", "BFGoodrich", "Cooper", "Maxxis", "Firestone", "Kumho", "Linglong", "Other Brands"]}
                    for n, s in [
                        ("Car Tyres", "car-tyres"), ("SUV Tyres", "suv-tyres"),
                        ("Truck Tyres", "truck-tyres"), ("Bus Tyres", "bus-tyres"),
                        ("Motorcycle Tyres", "motorcycle-tyres"), ("Agricultural Tyres", "agricultural-tyres"),
                        ("Off-Road Tyres", "off-road-tyres"), ("Performance Tyres", "performance-tyres"),
                        ("Run-Flat Tyres", "run-flat-tyres"), ("Winter Tyres", "winter-tyres"),
                        ("Alloy Wheels", "alloy-wheels"), ("Steel Wheels", "steel-wheels"),
                        ("Wheel Rims", "wheel-rims"), ("Wheel Covers", "wheel-covers"),
                        ("Wheel Spacers", "wheel-spacers"), ("Wheel Nuts", "wheel-nuts"),
                        ("Tyre Tubes", "tyre-tubes"), ("Tyre Repair Kits", "tyre-repair-kits"),
                        ("Tyre Pressure Sensors", "tyre-pressure-sensors"),
                    ]
                ],
            },
            {
                "name_en": "Vehicle Batteries & Electrical",
                "slug": "vehicle-batteries-electrical",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Amaron", "Exide", "Yuasa", "Bosch", "Varta", "Delkor", "Energizer", "Century", "Optima", "Other Brands"]}
                    for n, s in [
                        ("Car Batteries", "car-batteries"), ("Motorcycle Batteries", "motorcycle-batteries"),
                        ("Truck Batteries", "truck-batteries"), ("Bus Batteries", "bus-batteries"),
                        ("Deep Cycle Batteries", "deep-cycle-batteries"),
                        ("AGM Batteries", "agm-batteries"), ("Gel Batteries", "gel-batteries"),
                        ("Lithium Batteries", "lithium-batteries"), ("Hybrid Batteries", "hybrid-batteries"),
                        ("EV Batteries", "ev-batteries"), ("Battery Chargers", "battery-chargers"),
                        ("Battery Testers", "battery-testers"), ("Jump Starters", "jump-starters"),
                        ("Alternators", "alternators"), ("Starters", "starters"), ("Fuses", "fuses"),
                        ("Relays", "relays-vehicle"), ("Vehicle Wiring", "vehicle-wiring"),
                        ("Vehicle Bulbs", "vehicle-bulbs"), ("LED Headlights", "led-headlights"),
                    ]
                ],
            },
            {
                "name_en": "Vehicle Accessories",
                "slug": "vehicle-accessories",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Toyota", "Ford", "Nissan", "Honda", "Thule", "Yakima", "Michelin", "Bosch", "3M", "Turtle Wax", "Meguiar's", "Other Brands"]}
                    for n, s in [
                        ("Car Seat Covers", "car-seat-covers"), ("Floor Mats", "floor-mats"),
                        ("Car Carpets", "car-carpets"), ("Steering Wheel Covers", "steering-wheel-covers"),
                        ("Gear Shift Covers", "gear-shift-covers"), ("Car Sun Shades", "car-sun-shades"),
                        ("Car Phone Holders", "car-phone-holders"), ("Car Organizers", "car-organizers"),
                        ("Roof Racks", "roof-racks"), ("Roof Boxes", "roof-boxes"),
                        ("Tow Bars", "tow-bars"), ("Bull Bars", "bull-bars"), ("Side Steps", "side-steps"),
                        ("Mud Flaps", "mud-flaps"), ("Spoilers", "spoilers"), ("Car Covers", "car-covers"),
                    ]
                ],
            },
            {
                "name_en": "Vehicle Electronics",
                "slug": "vehicle-electronics",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Pioneer", "Kenwood", "Sony", "JVC", "Alpine", "JBL", "Garmin", "70mai", "DDPAI", "Baseus", "Xiaomi", "Anker", "Bosch", "Launch", "Autel", "Other Brands"]}
                    for n, s in [
                        ("Car Radios", "car-radios"), ("Android Car Screens", "android-car-screens"),
                        ("Car Stereos", "car-stereos"), ("Car Speakers", "car-speakers"),
                        ("Car Amplifiers", "car-amplifiers"), ("Car Subwoofers", "car-subwoofers"),
                        ("Dash Cameras", "dash-cameras"), ("Reverse Cameras", "reverse-cameras"),
                        ("Parking Sensors", "parking-sensors"), ("GPS Navigation", "gps-navigation"),
                        ("GPS Trackers", "gps-trackers"), ("Car Alarms", "car-alarms"),
                        ("Remote Starters", "remote-starters"),
                        ("Keyless Entry Systems", "keyless-entry-systems"),
                        ("Tire Pressure Monitors", "tire-pressure-monitors"),
                        ("Vehicle Diagnostic Tools", "vehicle-diagnostic-tools"),
                        ("OBD Scanners", "obd-scanners"), ("Bluetooth Car Devices", "bluetooth-car-devices"),
                        ("Car Chargers", "car-chargers"),
                    ]
                ],
            },
            {
                "name_en": "Car Care & Maintenance",
                "slug": "car-care-maintenance",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Castrol", "Shell", "Mobil", "Total", "Motul", "Valvoline", "Shell Helix", "Liqui Moly", "Meguiar's", "Turtle Wax", "Sonax", "Armor All", "3M", "Other Brands"]}
                    for n, s in [
                        ("Engine Oil", "engine-oil"), ("Gearbox Oil", "gearbox-oil"),
                        ("Brake Fluid", "brake-fluid"), ("Coolant", "coolant"),
                        ("Transmission Fluid", "transmission-fluid"),
                        ("Power Steering Fluid", "power-steering-fluid"),
                        ("Windscreen Washer Fluid", "windscreen-washer-fluid"), ("Car Wax", "car-wax"),
                        ("Car Polish", "car-polish"), ("Car Shampoo", "car-shampoo"),
                        ("Dashboard Cleaner", "dashboard-cleaner"), ("Tyre Cleaner", "tyre-cleaner"),
                        ("Glass Cleaner", "glass-cleaner"), ("Interior Cleaner", "interior-cleaner"),
                        ("Leather Cleaner", "leather-cleaner"), ("Air Fresheners", "air-fresheners-vehicle"),
                        ("Cleaning Cloths", "cleaning-cloths-vehicle"),
                        ("Car Cleaning Brushes", "car-cleaning-brushes"),
                        ("Pressure Washers", "pressure-washers"),
                        ("Car Vacuum Cleaners", "car-vacuum-cleaners"),
                        ("Car Cleaning Kits", "car-cleaning-kits"),
                    ]
                ],
            },
            {
                "name_en": "Motorcycle Parts & Accessories",
                "slug": "motorcycle-parts-accessories",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Bajaj", "Boxer", "TVS", "Honda", "Yamaha", "Suzuki", "Kawasaki", "KTM", "Royal Enfield", "Harley-Davidson", "Michelin", "NGK", "Denso", "Other Brands"]}
                    for n, s in [
                        ("Motorcycle Engines", "motorcycle-engines"), ("Motorcycle Chains", "motorcycle-chains"),
                        ("Motorcycle Sprockets", "motorcycle-sprockets"),
                        ("Brake Pads", "brake-pads-moto"), ("Brake Discs", "brake-discs-moto"),
                        ("Clutch Parts", "clutch-parts"), ("Air Filters", "air-filters-moto"),
                        ("Oil Filters", "oil-filters-moto"), ("Spark Plugs", "spark-plugs-moto"),
                        ("Motorcycle Exhausts", "motorcycle-exhausts"),
                        ("Motorcycle Mirrors", "motorcycle-mirrors"),
                        ("Motorcycle Lights", "motorcycle-lights"), ("Motorcycle Seats", "motorcycle-seats"),
                        ("Motorcycle Covers", "motorcycle-covers"),
                        ("Motorcycle Helmets", "motorcycle-helmets"),
                        ("Motorcycle Gloves", "motorcycle-gloves"),
                        ("Motorcycle Jackets", "motorcycle-jackets"),
                        ("Motorcycle Boots", "motorcycle-boots"),
                        ("Motorcycle Luggage", "motorcycle-luggage"), ("Phone Holders", "phone-holders-moto"),
                        ("Motorcycle Alarms", "motorcycle-alarms"),
                    ]
                ],
            },
            {
                "name_en": "Vehicle Safety Equipment",
                "slug": "vehicle-safety-equipment",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["3M", "Bosch", "Michelin", "Stanley", "Black+Decker", "Total", "Local Brand", "Other Brands"]}
                    for n, s in [
                        ("Car Fire Extinguishers", "car-fire-extinguishers"),
                        ("First Aid Kits", "first-aid-kits-vehicle"),
                        ("Warning Triangles", "warning-triangles"),
                        ("Reflective Vests", "reflective-vests"),
                        ("Emergency Road Kits", "emergency-road-kits"), ("Jump Cables", "jump-cables"),
                        ("Tow Ropes", "tow-ropes"), ("Tow Straps", "tow-straps"),
                        ("Emergency Lights", "emergency-lights-vehicle"),
                        ("Roadside Warning Lights", "roadside-warning-lights"),
                        ("Safety Cones", "safety-cones"), ("Tire Repair Kits", "tire-repair-kits"),
                        ("Emergency Hammers", "emergency-hammers"), ("Safety Gloves", "safety-gloves-vehicle"),
                    ]
                ],
            },
            {
                "name_en": "Vehicle Documents & Number Plates",
                "slug": "vehicle-documents-number-plates",  # new
                "subsubcategories": [
                    {"name_en": n, "slug": s, "brands": ["Generic", "Custom Made", "Local Manufacturer", "Other Brands"]}
                    for n, s in [
                        ("Number Plates", "number-plates"), ("Number Plate Frames", "number-plate-frames"),
                        ("Vehicle Stickers", "vehicle-stickers"), ("Vehicle Decals", "vehicle-decals"),
                        ("Reflective Stickers", "reflective-stickers"),
                        ("Parking Stickers", "parking-stickers"),
                        ("Driving Accessories", "driving-accessories"),
                        ("Vehicle Logbook Accessories", "vehicle-logbook-accessories"),
                        ("Document Holders", "document-holders"),
                        ("License Plate Accessories", "license-plate-accessories"),
                    ]
                ],
            },
        ],
    },
]


def upsert_category(session: Session, data: dict) -> Category:
    existing = session.exec(select(Category).where(Category.slug == data["slug"])).first()
    if existing:
        for field in ("name_en", "name_so", "icon_name", "image_url"):
            if field in data:
                setattr(existing, field, data[field])
        session.add(existing)
        session.commit()
        session.refresh(existing)
        print(f"  updated category: {existing.name_en} (id={existing.id})")
        return existing

    category = Category(
        name_en=data["name_en"],
        name_so=data.get("name_so"),
        slug=data["slug"],
        icon_name=data.get("icon_name", "Folder"),
        image_url=data.get("image_url"),
    )
    session.add(category)
    session.commit()
    session.refresh(category)
    print(f"  created category: {category.name_en} (id={category.id})")
    return category


def upsert_subcategory(session: Session, category_id: int, data: dict) -> Subcategory:
    existing = session.exec(select(Subcategory).where(Subcategory.slug == data["slug"])).first()
    if existing:
        existing.category_id = category_id
        for field in ("name_en", "name_so", "icon_name", "image_url"):
            if field in data:
                setattr(existing, field, data[field])
        session.add(existing)
        session.commit()
        session.refresh(existing)
        print(f"    updated subcategory: {existing.name_en} (id={existing.id})")
        return existing

    subcategory = Subcategory(
        category_id=category_id,
        name_en=data["name_en"],
        name_so=data.get("name_so"),
        slug=data["slug"],
        icon_name=data.get("icon_name"),
        image_url=data.get("image_url"),
    )
    session.add(subcategory)
    session.commit()
    session.refresh(subcategory)
    print(f"    created subcategory: {subcategory.name_en} (id={subcategory.id})")
    return subcategory


def upsert_subsubcategory(session: Session, subcategory_id: int, data: dict) -> SubSubCategory:
    existing = session.exec(select(SubSubCategory).where(SubSubCategory.slug == data["slug"])).first()
    if existing:
        existing.subcategory_id = subcategory_id
        for field in ("name_en", "name_so", "image_url", "brands"):
            if field in data:
                setattr(existing, field, data[field])
        session.add(existing)
        session.commit()
        session.refresh(existing)
        print(f"      updated sub-subcategory: {existing.name_en} (id={existing.id}, brands={existing.brands})")
        return existing

    subsubcategory = SubSubCategory(
        subcategory_id=subcategory_id,
        name_en=data["name_en"],
        name_so=data.get("name_so"),
        slug=data["slug"],
        image_url=data.get("image_url"),
        brands=data.get("brands"),
    )
    session.add(subsubcategory)
    session.commit()
    session.refresh(subsubcategory)
    print(f"      created sub-subcategory: {subsubcategory.name_en} (id={subsubcategory.id}, brands={subsubcategory.brands})")
    return subsubcategory


def print_plan(hierarchy: list) -> None:
    for cat in hierarchy:
        print(f"- {cat['name_en']} ({cat['slug']})")
        for sub in cat.get("subcategories", []):
            print(f"  - {sub['name_en']} ({sub['slug']})")
            for ssub in sub.get("subsubcategories", []):
                brands = ssub.get("brands", [])
                print(f"    - {ssub['name_en']} ({ssub['slug']}) -- brands: {', '.join(brands) if brands else '(none)'}")


def seed(session: Session, hierarchy: list) -> None:
    for cat_data in hierarchy:
        category = upsert_category(session, cat_data)
        for sub_data in cat_data.get("subcategories", []):
            subcategory = upsert_subcategory(session, category.id, sub_data)
            for ssub_data in sub_data.get("subsubcategories", []):
                upsert_subsubcategory(session, subcategory.id, ssub_data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    parser.add_argument("--dry-run", action="store_true", help="Print the plan and exit without writing")
    args = parser.parse_args()

    host = settings.DATABASE_URL.split("@")[-1].split("/")[0] if "@" in settings.DATABASE_URL else settings.DATABASE_URL
    print(f"Target database: {host}\n")
    print("Plan:")
    print_plan(HIERARCHY)

    if args.dry_run:
        print("\n--dry-run: no changes written.")
        return

    if not args.yes:
        confirm = input("\nApply these changes? [y/N] ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            sys.exit(1)

    with Session(engine) as session:
        seed(session, HIERARCHY)

    print("\nDone.")


if __name__ == "__main__":
    main()
