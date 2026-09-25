#!/usr/bin/env python3
"""
Seed script to populate categories, subcategories, and attributes.
Run with: python seed_categories_attributes.py
"""
import sys
from sqlmodel import Session, create_engine
from app.core.config import settings
from app.models.subcategory import Subcategory
from app.models.attribute_group import AttributeGroup
from app.models.attribute import Attribute
from app.models.attribute_option import AttributeOption
from app.models.category_attribute import CategoryAttribute
from app.models.subcategory_attribute import SubcategoryAttribute

engine = create_engine(settings.DATABASE_URL)


CATEGORIES_DATA = {
    1: {
        "name_en": "Clothing & Shoes",
        "name_so": "Dharka & Kabaha",
        "subcategories": [
            ("Men's Clothing", "Dharka Lab"),
            ("Women's Clothing", "Dharka Gabar"),
            ("Children's Clothing", "Dharka Carruur"),
            ("Shoes", "Kabaha"),
            ("Bags", "Bags"),
            ("Watches", "Saacad"),
            ("Jewelry", "Jewelry"),
            ("Accessories", "Accessories"),
        ],
        "attributes": [
            ("Brand", "select", ["Nike", "Adidas", "Puma", "Local Brand"]),
            ("Condition", "select", ["New", "Like New", "Good", "Fair"]),
            ("Gender", "select", ["Men", "Women", "Unisex", "Children"]),
            ("Size", "text", None),
            ("Color", "select", ["Black", "White", "Red", "Blue", "Green", "Other"]),
            ("Material", "text", None),
            ("Style", "text", None),
            ("Pattern", "select", ["Solid", "Striped", "Checkered", "Floral", "Other"]),
            ("Quantity", "number", None),
        ]
    },
    2: {
        "name_en": "Beauty & Personal Care",
        "name_so": "Caafimaadka & Quruxda",
        "subcategories": [
            ("Skincare", "Skincare"),
            ("Makeup", "Makeup"),
            ("Hair Care", "Hair Care"),
            ("Fragrances", "Fragrances"),
            ("Personal Hygiene", "Personal Hygiene"),
            ("Beauty Tools", "Beauty Tools"),
        ],
        "attributes": [
            ("Brand", "select", ["L'Oreal", "Maybelline", "MAC", "Local Brand"]),
            ("Product Type", "select", ["Face Cream", "Serum", "Mask", "Cleanser", "Other"]),
            ("Skin Type", "select", ["Oily", "Dry", "Combination", "Sensitive"]),
            ("Hair Type", "select", ["Straight", "Curly", "Wavy", "Coily"]),
            ("Volume", "text", None),
            ("Expiry Date", "date", None),
            ("Country Of Origin", "text", None),
        ]
    },
    3: {
        "name_en": "Household Items",
        "name_so": "Alaabta Guriga",
        "subcategories": [
            ("Furniture", "Furniture"),
            ("Kitchenware", "Kitchenware"),
            ("Home Decor", "Home Decor"),
            ("Appliances", "Appliances"),
            ("Storage", "Storage"),
            ("Bedding", "Bedding"),
        ],
        "attributes": [
            ("Brand", "text", None),
            ("Condition", "select", ["New", "Like New", "Good", "Fair"]),
            ("Material", "select", ["Wood", "Metal", "Plastic", "Ceramic", "Other"]),
            ("Color", "text", None),
            ("Dimensions", "text", None),
            ("Weight", "text", None),
            ("Assembly Required", "checkbox", None),
        ]
    },
    4: {
        "name_en": "Electronics",
        "name_so": "Korontada & Elektaroonik",
        "subcategories": [
            ("TVs", "TVs"),
            ("Laptops", "Laptops"),
            ("Gaming", "Gaming"),
            ("Cameras", "Cameras"),
            ("Audio Systems", "Audio Systems"),
            ("Accessories", "Accessories"),
        ],
        "attributes": [
            ("Brand", "text", None),
            ("Condition", "select", ["New", "Like New", "Good", "Fair"]),
            ("Model", "text", None),
            ("Storage", "text", None),
            ("RAM", "text", None),
            ("Processor", "text", None),
            ("Screen Size", "text", None),
            ("Warranty", "text", None),
            ("Color", "text", None),
        ]
    },
    5: {
        "name_en": "Food & Groceries",
        "name_so": "Raashinka & Badeecadaha",
        "subcategories": [
            ("Fruits", "Fruits"),
            ("Vegetables", "Vegetables"),
            ("Beverages", "Beverages"),
            ("Packaged Foods", "Packaged Foods"),
            ("Spices", "Spices"),
            ("Meat & Poultry", "Meat & Poultry"),
        ],
        "attributes": [
            ("Brand", "text", None),
            ("Weight", "text", None),
            ("Quantity", "text", None),
            ("Expiry Date", "date", None),
            ("Organic", "checkbox", None),
            ("Country Of Origin", "text", None),
        ]
    },
    6: {
        "name_en": "Vehicles",
        "name_so": "Gaadidka",
        "subcategories": [
            ("Cars", "Cars"),
            ("SUVs", "SUVs"),
            ("Vans", "Vans"),
            ("Trucks", "Trucks"),
            ("Motorcycles", "Motorcycles"),
            ("Spare Parts", "Spare Parts"),
        ],
        "attributes": [
            ("Make", "text", None),
            ("Model", "text", None),
            ("Year", "number", None),
            ("Mileage", "text", None),
            ("Fuel Type", "select", ["Petrol", "Diesel", "Hybrid", "Electric"]),
            ("Transmission", "select", ["Manual", "Automatic"]),
            ("Engine Capacity", "text", None),
            ("Color", "text", None),
            ("Condition", "select", ["Excellent", "Good", "Fair", "Needs Repair"]),
        ]
    },
    16: {
        "name_en": "Phones",
        "name_so": "Taleefammada & Tableedyada",
        "subcategories": [
            ("Smartphones", "Smartphones"),
            ("Feature Phones", "Feature Phones"),
            ("Tablets", "Tablets"),
            ("Accessories", "Accessories"),
        ],
        "attributes": [
            ("Brand", "text", None),
            ("Model", "text", None),
            ("Condition", "select", ["New", "Like New", "Good", "Fair"]),
            ("Storage", "text", None),
            ("RAM", "text", None),
            ("Battery Health", "text", None),
            ("Network", "select", ["3G", "4G", "5G"]),
            ("Color", "text", None),
            ("SIM Type", "select", ["Dual SIM", "Single SIM"]),
            ("Warranty", "text", None),
        ]
    },
}


def create_attribute_groups():
    """Create base attribute groups."""
    with Session(engine) as session:
        groups = [
            AttributeGroup(name="General", slug="general", description="General attributes for all products"),
            AttributeGroup(name="Condition", slug="condition", description="Product condition"),
            AttributeGroup(name="Specifications", slug="specifications", description="Technical specifications"),
            AttributeGroup(name="Details", slug="details", description="Additional details"),
        ]
        for group in groups:
            existing = session.exec(
                session.query(AttributeGroup).filter(AttributeGroup.slug == group.slug)
            ).first()
            if not existing:
                session.add(group)
        session.commit()
        print("✅ Attribute groups created")


def create_attributes():
    """Create all attributes (this is simplified - you'd need to map each attribute to groups)."""
    with Session(engine) as session:
        # For now, create a "General" attribute for testing
        general_group = session.exec(
            session.query(AttributeGroup).filter(AttributeGroup.slug == "general")
        ).first()

        if general_group:
            # Create some common attributes
            attributes = [
                Attribute(attribute_group_id=general_group.id, name="Brand", slug="brand", field_type="text"),
                Attribute(attribute_group_id=general_group.id, name="Condition", slug="condition", field_type="select"),
                Attribute(attribute_group_id=general_group.id, name="Color", slug="color", field_type="select"),
                Attribute(attribute_group_id=general_group.id, name="Size", slug="size", field_type="text"),
            ]

            for attr in attributes:
                existing = session.exec(
                    session.query(Attribute).filter(Attribute.slug == attr.slug)
                ).first()
                if not existing:
                    session.add(attr)

            session.commit()
            print("✅ Attributes created")


def create_subcategories():
    """Create subcategories for each category."""
    with Session(engine) as session:
        for cat_id, cat_data in CATEGORIES_DATA.items():
            for subcat_name_en, subcat_name_so in cat_data.get("subcategories", []):
                slug = subcat_name_en.lower().replace(" ", "-").replace("&", "and")
                existing = session.exec(
                    session.query(Subcategory).filter(Subcategory.slug == slug)
                ).first()

                if not existing:
                    subcat = Subcategory(
                        category_id=cat_id,
                        name_en=subcat_name_en,
                        name_so=subcat_name_so,
                        slug=slug,
                    )
                    session.add(subcat)

            session.commit()

        print(f"✅ Subcategories created for all categories")


def main():
    """Run all seeding operations."""
    try:
        print("🌱 Starting category and attribute seeding...\n")
        create_attribute_groups()
        create_attributes()
        create_subcategories()
        print("\n✨ Category and attribute seeding complete!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
