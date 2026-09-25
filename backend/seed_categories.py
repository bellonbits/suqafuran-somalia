#!/usr/bin/env python3
"""
Seed script to populate categories and subcategories.
Run with: python seed_categories.py
"""
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

SUBCATEGORIES = [
    # Clothing & Shoes (1)
    (1, "Men's Clothing", "Dharka Lab"),
    (1, "Women's Clothing", "Dharka Gabar"),
    (1, "Children's Clothing", "Dharka Carruur"),
    (1, "Shoes", "Kabaha"),
    (1, "Bags", "Bags"),
    (1, "Watches", "Saacad"),
    (1, "Jewelry", "Jewelry"),
    (1, "Accessories", "Accessories"),

    # Beauty & Personal Care (2)
    (2, "Skincare", "Skincare"),
    (2, "Makeup", "Makeup"),
    (2, "Hair Care", "Hair Care"),
    (2, "Fragrances", "Fragrances"),
    (2, "Personal Hygiene", "Personal Hygiene"),
    (2, "Beauty Tools", "Beauty Tools"),

    # Household Items (3)
    (3, "Furniture", "Furniture"),
    (3, "Kitchenware", "Kitchenware"),
    (3, "Home Decor", "Home Decor"),
    (3, "Appliances", "Appliances"),
    (3, "Storage", "Storage"),
    (3, "Bedding", "Bedding"),

    # Electronics (4)
    (4, "TVs", "TVs"),
    (4, "Laptops", "Laptops"),
    (4, "Gaming", "Gaming"),
    (4, "Cameras", "Cameras"),
    (4, "Audio Systems", "Audio Systems"),
    (4, "Accessories", "Accessories"),

    # Food & Groceries (5)
    (5, "Fruits", "Fruits"),
    (5, "Vegetables", "Vegetables"),
    (5, "Beverages", "Beverages"),
    (5, "Packaged Foods", "Packaged Foods"),
    (5, "Spices", "Spices"),
    (5, "Meat & Poultry", "Meat & Poultry"),

    # Vehicles (6)
    (6, "Cars", "Cars"),
    (6, "SUVs", "SUVs"),
    (6, "Vans", "Vans"),
    (6, "Trucks", "Trucks"),
    (6, "Motorcycles", "Motorcycles"),
    (6, "Spare Parts", "Spare Parts"),

    # Services (9)
    (9, "Cleaning", "Cleaning"),
    (9, "Electrical", "Electrical"),
    (9, "Plumbing", "Plumbing"),
    (9, "Software Development", "Software Development"),
    (9, "Graphic Design", "Graphic Design"),
    (9, "Consultancy", "Consultancy"),

    # Leisure & Sports (13)
    (13, "Gym Equipment", "Gym Equipment"),
    (13, "Sportswear", "Sportswear"),
    (13, "Outdoor Equipment", "Outdoor Equipment"),
    (13, "Bicycles", "Bicycles"),
    (13, "Camping Gear", "Camping Gear"),

    # Livestock (6)
    (6, "Cattle", "Cattle"),
    (6, "Goats", "Goats"),
    (6, "Sheep", "Sheep"),
    (6, "Camels", "Camels"),
    (6, "Poultry", "Poultry"),

    # Phones (16)
    (16, "Smartphones", "Smartphones"),
    (16, "Feature Phones", "Feature Phones"),
    (16, "Tablets", "Tablets"),
    (16, "Accessories", "Accessories"),

    # Commercial Equipment (14)
    (14, "Construction Equipment", "Construction Equipment"),
    (14, "Industrial Machines", "Industrial Machines"),
    (14, "Generators", "Generators"),
    (14, "Restaurant Equipment", "Restaurant Equipment"),

    # Land & Farms (7)
    (7, "Agricultural Land", "Agricultural Land"),
    (7, "Farms", "Farms"),
    (7, "Ranches", "Ranches"),

    # Babies & Kids (15)
    (15, "Baby Clothing", "Baby Clothing"),
    (15, "Toys", "Toys"),
    (15, "Strollers", "Strollers"),
    (15, "Feeding Supplies", "Feeding Supplies"),

    # Property (8)
    (8, "Houses", "Houses"),
    (8, "Apartments", "Apartments"),
    (8, "Commercial Property", "Commercial Property"),
    (8, "Land", "Land"),

    # Agriculture & Food (17)
    (17, "Seeds", "Seeds"),
    (17, "Fertilizers", "Fertilizers"),
    (17, "Animal Feed", "Animal Feed"),
    (17, "Farm Equipment", "Farm Equipment"),
]

def seed_subcategories():
    """Seed subcategories into the database."""
    with engine.connect() as conn:
        for category_id, name_en, name_so in SUBCATEGORIES:
            slug = name_en.lower().replace(" ", "-").replace("&", "and")

            # Check if already exists
            result = conn.execute(text(
                "SELECT id FROM subcategory WHERE slug = :slug"
            ), {"slug": slug})

            if result.fetchone() is None:
                conn.execute(text(
                    """INSERT INTO subcategory (category_id, name_en, name_so, slug)
                       VALUES (:cat_id, :name_en, :name_so, :slug)"""
                ), {
                    "cat_id": category_id,
                    "name_en": name_en,
                    "name_so": name_so,
                    "slug": slug,
                })

        conn.commit()
        print(f"✅ {len(SUBCATEGORIES)} subcategories seeded successfully!")


if __name__ == "__main__":
    try:
        print("🌱 Seeding subcategories...\n")
        seed_subcategories()
        print("\n✨ Seeding complete!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
