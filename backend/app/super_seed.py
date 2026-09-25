import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'suqafuran.db')

# Category Definitions
CATEGORIES = [
    {"name": "Vehicles", "slug": "vehicles", "icon": "Car"},
    {"name": "Mobile Phones & Tablets", "slug": "mobile-phones-tablets", "icon": "Smartphone"},
    {"name": "Electronics", "slug": "electronics", "icon": "Laptop"},
    {"name": "Property", "slug": "property", "icon": "Home"},
    {"name": "Home, Furniture & Appliances", "slug": "home-furniture-appliances", "icon": "Bed"},
    {"name": "Health & Beauty", "icon": "Sparkles", "slug": "health-beauty"},
    {"name": "Fashion", "slug": "fashion", "icon": "Shirt"},
    {"name": "Animals & Pets", "slug": "animals-pets", "icon": "Dog"},
    {"name": "Agriculture & Food", "slug": "agriculture-food", "icon": "Leaf"},
    {"name": "Commercial Equipment & Tools", "slug": "commercial-equipment-tools", "icon": "Briefcase"},
    {"name": "Repair & Construction", "slug": "repair-construction", "icon": "Hammer"},
    {"name": "Services", "slug": "services", "icon": "Settings"},
    {"name": "Jobs", "slug": "jobs", "icon": "UserCircle"},
]

# Field Templates
basic_condition = {"name": "condition", "label": "Condition", "type": "select", "options": ["Brand New", "Used", "Refurbished"], "required": True}
brand_field = {"name": "brand", "label": "Brand", "type": "text", "required": False}
food_fields = [
    brand_field,
    {"name": "type", "label": "Type*", "type": "text", "required": True},
    {"name": "specialty", "label": "Specialty", "type": "text", "required": False},
    {"name": "dietary_needs", "label": "Dietary Needs", "type": "text", "required": False}
]

# Subcategory Mappings (Category Slug -> Subcategories)
SUBCATEGORIES = {
    "vehicles": [
        {"name": "Cars", "slug": "cars", "schema": [
            {"name": "make", "label": "Make", "type": "text", "required": True},
            {"name": "model", "label": "Model", "type": "text", "required": True},
            {"name": "year", "label": "Year of Manufacture", "type": "number", "required": True},
            {"name": "transmission", "label": "Transmission", "type": "select", "options": ["Automatic", "Manual"], "required": True},
            {"name": "fuel", "label": "Fuel Type", "type": "select", "options": ["Petrol", "Diesel", "Hybrid", "Electric"], "required": True},
        ]},
        {"name": "Motorcycles", "slug": "motorcycles", "schema": [brand_field, {"name": "engine", "label": "Engine Capacity", "type": "text"}]},
    ],
    "agriculture-food": [
        {"name": "Vegetables", "slug": "vegetables", "schema": food_fields},
        {"name": "Fruits", "slug": "fruits", "schema": food_fields},
        {"name": "Rice & Pasta", "slug": "rice-pasta", "schema": food_fields},
        {"name": "Meat", "slug": "meat", "schema": food_fields},
    ],
    "mobile-phones-tablets": [
        {"name": "Mobile Phones", "slug": "mobile-phones", "schema": [
            {"name": "brand", "label": "Brand", "type": "select", "options": ["Apple", "Samsung", "Nokia", "Tecno", "Infinix", "Other"], "required": True},
            {"name": "model", "label": "Model", "type": "text", "required": True},
            {"name": "storage", "label": "Storage", "type": "select", "options": ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB"], "required": True},
        ]}
    ],
    "electronics": [
        {"name": "Laptops", "slug": "computers", "schema": [brand_field, {"name": "ram", "label": "RAM", "type": "text"}]},
        {"name": "TVs", "slug": "tvs", "schema": [brand_field, {"name": "screen_size", "label": "Screen Size", "type": "text"}]}
    ]
}

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Checking tables...")
    cursor.execute("CREATE TABLE IF NOT EXISTS category (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR NOT NULL, slug VARCHAR NOT NULL UNIQUE, icon_name VARCHAR, image_url VARCHAR, attributes_schema JSON)")
    cursor.execute("CREATE TABLE IF NOT EXISTS subcategory (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR NOT NULL, slug VARCHAR NOT NULL UNIQUE, icon_name VARCHAR, image_url VARCHAR, category_id INTEGER, attributes_schema JSON)")
    cursor.execute("CREATE TABLE IF NOT EXISTS subsubcategory (id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR NOT NULL, slug VARCHAR NOT NULL UNIQUE, image_url VARCHAR, subcategory_id INTEGER)")

    print("Seeding categories...")
    for cat in CATEGORIES:
        cursor.execute("INSERT OR IGNORE INTO category (name, slug, icon_name) VALUES (?, ?, ?)", (cat["name"], cat["slug"], cat["icon"]))
    
    # Get category IDs
    cursor.execute("SELECT id, slug FROM category")
    cat_map = {slug: cid for cid, slug in cursor.fetchall()}

    print("Seeding subcategories...")
    for cat_slug, subs in SUBCATEGORIES.items():
        cat_id = cat_map.get(cat_slug)
        if not cat_id: continue
        for sub in subs:
            cursor.execute("INSERT OR REPLACE INTO subcategory (name, slug, category_id, attributes_schema) VALUES (?, ?, ?, ?)", 
                         (sub["name"], sub["slug"], cat_id, json.dumps(sub["schema"])))

    conn.commit()
    conn.close()
    print("Seeding complete!")

if __name__ == "__main__":
    seed()
