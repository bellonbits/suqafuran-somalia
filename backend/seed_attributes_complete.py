#!/usr/bin/env python3
"""
Complete attribute seeding for all 17 categories.
Run with: python seed_attributes_complete.py
"""
import sys
from sqlalchemy import create_engine, text
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

ATTRIBUTE_CONFIG = {
    1: {  # Clothing & Shoes
        "name": "Clothing & Shoes",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "select", "required": False, "options": ["Nike", "Adidas", "Puma", "Local Brand", "Other"]},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair", "Poor"]},
            {"name": "Size", "slug": "size", "type": "select", "required": True, "options": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]},
            {"name": "Color", "slug": "color", "type": "select", "required": False, "options": ["Black", "White", "Red", "Blue", "Green", "Yellow", "Brown", "Gray", "Other"]},
            {"name": "Material", "slug": "material", "type": "select", "required": False, "options": ["Cotton", "Polyester", "Wool", "Silk", "Leather", "Synthetic", "Mixed"]},
            {"name": "Gender", "slug": "gender", "type": "select", "required": False, "options": ["Men", "Women", "Unisex", "Children"]},
        ]
    },
    2: {  # Beauty & Personal Care
        "name": "Beauty & Personal Care",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": False},
            {"name": "Product Type", "slug": "product-type", "type": "select", "required": True, "options": ["Face Cream", "Serum", "Mask", "Cleanser", "Makeup", "Hair Care", "Body Care", "Other"]},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Unopened", "Lightly Used", "Used"]},
            {"name": "Volume", "slug": "volume", "type": "text", "required": False},
            {"name": "Expiry Date", "slug": "expiry-date", "type": "text", "required": False},
            {"name": "Skin Type", "slug": "skin-type", "type": "select", "required": False, "options": ["Oily", "Dry", "Combination", "Sensitive", "Normal"]},
        ]
    },
    3: {  # Household Items
        "name": "Household Items",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": False},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair"]},
            {"name": "Material", "slug": "material", "type": "select", "required": False, "options": ["Wood", "Metal", "Plastic", "Ceramic", "Glass", "Fabric", "Mixed"]},
            {"name": "Color", "slug": "color", "type": "text", "required": False},
            {"name": "Dimensions", "slug": "dimensions", "type": "text", "required": False},
            {"name": "Assembly Required", "slug": "assembly-required", "type": "select", "required": False, "options": ["Yes", "No"]},
        ]
    },
    4: {  # Electronics
        "name": "Electronics",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": True},
            {"name": "Model", "slug": "model", "type": "text", "required": False},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair", "For Parts"]},
            {"name": "Warranty", "slug": "warranty", "type": "select", "required": False, "options": ["Yes", "No", "Partial"]},
            {"name": "Color", "slug": "color", "type": "text", "required": False},
            {"name": "Year Purchased", "slug": "year-purchased", "type": "text", "required": False},
        ]
    },
    4.1: {  # Electronics - Laptops (subcategory specific)
        "name": "Electronics - Laptops",
        "attributes": [
            {"name": "Processor", "slug": "processor", "type": "text", "required": False},
            {"name": "RAM", "slug": "ram", "type": "select", "required": False, "options": ["4GB", "8GB", "16GB", "32GB", "64GB"]},
            {"name": "Storage", "slug": "storage", "type": "select", "required": False, "options": ["128GB", "256GB", "512GB", "1TB", "2TB"]},
            {"name": "Screen Size", "slug": "screen-size", "type": "text", "required": False},
            {"name": "Graphics Card", "slug": "graphics-card", "type": "text", "required": False},
        ]
    },
    5: {  # Food & Groceries
        "name": "Food & Groceries",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": False},
            {"name": "Weight/Quantity", "slug": "weight-quantity", "type": "text", "required": False},
            {"name": "Expiry Date", "slug": "expiry-date", "type": "text", "required": False},
            {"name": "Organic", "slug": "organic", "type": "select", "required": False, "options": ["Yes", "No", "Certified"]},
            {"name": "Country of Origin", "slug": "country-of-origin", "type": "text", "required": False},
        ]
    },
    6: {  # Vehicles
        "name": "Vehicles",
        "attributes": [
            {"name": "Make", "slug": "make", "type": "text", "required": True},
            {"name": "Model", "slug": "model", "type": "text", "required": True},
            {"name": "Year", "slug": "year", "type": "text", "required": True},
            {"name": "Mileage", "slug": "mileage", "type": "text", "required": False},
            {"name": "Fuel Type", "slug": "fuel-type", "type": "select", "required": True, "options": ["Petrol", "Diesel", "Hybrid", "Electric", "LPG"]},
            {"name": "Transmission", "slug": "transmission", "type": "select", "required": True, "options": ["Manual", "Automatic"]},
            {"name": "Engine Capacity", "slug": "engine-capacity", "type": "text", "required": False},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["Excellent", "Good", "Fair", "Needs Repair"]},
            {"name": "Color", "slug": "color", "type": "text", "required": False},
            {"name": "Service History", "slug": "service-history", "type": "select", "required": False, "options": ["Yes", "No", "Partial"]},
        ]
    },
    7: {  # Services
        "name": "Services",
        "attributes": [
            {"name": "Service Type", "slug": "service-type", "type": "select", "required": True, "options": ["Hourly", "Fixed Price", "Project Based", "Monthly"]},
            {"name": "Experience Level", "slug": "experience-level", "type": "select", "required": False, "options": ["Beginner", "Intermediate", "Expert", "Professional"]},
            {"name": "Availability", "slug": "availability", "type": "select", "required": False, "options": ["Full Time", "Part Time", "Weekend Only", "On Demand"]},
            {"name": "Service Duration", "slug": "service-duration", "type": "text", "required": False},
        ]
    },
    8: {  # Property
        "name": "Property",
        "attributes": [
            {"name": "Property Type", "slug": "property-type", "type": "select", "required": True, "options": ["House", "Apartment", "Land", "Commercial"]},
            {"name": "Bedrooms", "slug": "bedrooms", "type": "select", "required": False, "options": ["1", "2", "3", "4", "5", "6+"]},
            {"name": "Bathrooms", "slug": "bathrooms", "type": "select", "required": False, "options": ["1", "2", "3", "4", "5+"]},
            {"name": "Area (sqft)", "slug": "area", "type": "text", "required": False},
            {"name": "Year Built", "slug": "year-built", "type": "text", "required": False},
            {"name": "Furnished", "slug": "furnished", "type": "select", "required": False, "options": ["Fully Furnished", "Partly Furnished", "Unfurnished"]},
            {"name": "Amenities", "slug": "amenities", "type": "select", "required": False, "options": ["Swimming Pool", "Gym", "Garden", "Garage", "Security", "CCTV"]},
        ]
    },
    9: {  # Jobs
        "name": "Jobs",
        "attributes": [
            {"name": "Job Title", "slug": "job-title", "type": "text", "required": True},
            {"name": "Job Type", "slug": "job-type", "type": "select", "required": True, "options": ["Full Time", "Part Time", "Contract", "Temporary", "Freelance"]},
            {"name": "Experience Required", "slug": "experience-required", "type": "text", "required": False},
            {"name": "Salary Range", "slug": "salary-range", "type": "text", "required": False},
            {"name": "Education Required", "slug": "education-required", "type": "select", "required": False, "options": ["High School", "Diploma", "Bachelor's", "Master's", "Not Required"]},
            {"name": "Skills Required", "slug": "skills-required", "type": "text", "required": False},
        ]
    },
    10: {  # Leisure & Sports
        "name": "Leisure & Sports",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": False},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair"]},
            {"name": "Size", "slug": "size", "type": "text", "required": False},
            {"name": "Color", "slug": "color", "type": "text", "required": False},
            {"name": "Material", "slug": "material", "type": "text", "required": False},
        ]
    },
    11: {  # Livestock
        "name": "Livestock",
        "attributes": [
            {"name": "Breed", "slug": "breed", "type": "text", "required": True},
            {"name": "Age", "slug": "age", "type": "text", "required": False},
            {"name": "Gender", "slug": "gender", "type": "select", "required": False, "options": ["Male", "Female"]},
            {"name": "Health Status", "slug": "health-status", "type": "select", "required": True, "options": ["Excellent", "Good", "Fair", "Sick"]},
            {"name": "Vaccination", "slug": "vaccination", "type": "select", "required": False, "options": ["Yes", "No", "Partial"]},
            {"name": "Weight", "slug": "weight", "type": "text", "required": False},
        ]
    },
    12: {  # Phones
        "name": "Phones",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": True},
            {"name": "Model", "slug": "model", "type": "text", "required": True},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair", "For Parts"]},
            {"name": "Storage", "slug": "storage", "type": "select", "required": False, "options": ["32GB", "64GB", "128GB", "256GB", "512GB"]},
            {"name": "RAM", "slug": "ram", "type": "select", "required": False, "options": ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB"]},
            {"name": "Color", "slug": "color", "type": "text", "required": False},
            {"name": "Network", "slug": "network", "type": "select", "required": False, "options": ["3G", "4G", "5G"]},
            {"name": "Warranty", "slug": "warranty", "type": "select", "required": False, "options": ["Yes", "No"]},
        ]
    },
    13: {  # Commercial Equipment
        "name": "Commercial Equipment",
        "attributes": [
            {"name": "Equipment Type", "slug": "equipment-type", "type": "text", "required": True},
            {"name": "Brand", "slug": "brand", "type": "text", "required": False},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair"]},
            {"name": "Year Manufactured", "slug": "year-manufactured", "type": "text", "required": False},
            {"name": "Usage Hours", "slug": "usage-hours", "type": "text", "required": False},
        ]
    },
    14: {  # Repair & Construction
        "name": "Repair & Construction",
        "attributes": [
            {"name": "Service Type", "slug": "service-type", "type": "text", "required": True},
            {"name": "Experience", "slug": "experience", "type": "select", "required": False, "options": ["Beginner", "Intermediate", "Expert"]},
            {"name": "Service Area", "slug": "service-area", "type": "text", "required": False},
            {"name": "Availability", "slug": "availability", "type": "select", "required": False, "options": ["Immediate", "This Week", "This Month"]},
        ]
    },
    15: {  # Land & Farms
        "name": "Land & Farms",
        "attributes": [
            {"name": "Area (acres)", "slug": "area-acres", "type": "text", "required": True},
            {"name": "Location Type", "slug": "location-type", "type": "select", "required": True, "options": ["Urban", "Suburban", "Rural"]},
            {"name": "Soil Type", "slug": "soil-type", "type": "text", "required": False},
            {"name": "Water Supply", "slug": "water-supply", "type": "select", "required": False, "options": ["Yes", "No", "Rainwater"]},
            {"name": "Accessibility", "slug": "accessibility", "type": "select", "required": False, "options": ["Good Roads", "Fair Roads", "Difficult Access"]},
        ]
    },
    16: {  # Babies & Kids
        "name": "Babies & Kids",
        "attributes": [
            {"name": "Brand", "slug": "brand", "type": "text", "required": False},
            {"name": "Condition", "slug": "condition", "type": "select", "required": True, "options": ["New", "Like New", "Good", "Fair"]},
            {"name": "Age Range", "slug": "age-range", "type": "select", "required": False, "options": ["0-6 months", "6-12 months", "1-2 years", "2-5 years", "5+ years"]},
            {"name": "Color", "slug": "color", "type": "text", "required": False},
            {"name": "Safety Certified", "slug": "safety-certified", "type": "select", "required": False, "options": ["Yes", "No"]},
        ]
    },
    17: {  # Agriculture & Food
        "name": "Agriculture & Food",
        "attributes": [
            {"name": "Product Type", "slug": "product-type", "type": "text", "required": True},
            {"name": "Quantity Available", "slug": "quantity", "type": "text", "required": False},
            {"name": "Quality Grade", "slug": "quality-grade", "type": "select", "required": False, "options": ["Premium", "Grade A", "Grade B", "Standard"]},
            {"name": "Organic", "slug": "organic", "type": "select", "required": False, "options": ["Yes", "No", "Certified"]},
            {"name": "Harvest Date", "slug": "harvest-date", "type": "text", "required": False},
            {"name": "Storage Requirements", "slug": "storage-requirements", "type": "text", "required": False},
        ]
    },
}

def seed_attributes():
    """Seed all attribute groups, attributes, and options."""
    with engine.connect() as conn:
        # Create attribute groups
        groups = ["General", "Condition", "Technical Specs", "Details"]
        for group in groups:
            slug = group.lower().replace(" ", "-")
            conn.execute(text("""
                INSERT INTO attribute_group (name, slug, description)
                VALUES (:name, :slug, :description)
                ON CONFLICT (slug) DO NOTHING
            """), {
                "name": group,
                "slug": slug,
                "description": f"{group} attributes"
            })

        conn.commit()
        print(f"✅ Created {len(groups)} attribute groups")

        # Get group IDs
        groups_result = conn.execute(text("SELECT id, slug FROM attribute_group"))
        group_map = {row[1]: row[0] for row in groups_result}

        # Seed attributes and options
        attr_count = 0
        option_count = 0

        for cat_id, cat_config in ATTRIBUTE_CONFIG.items():
            for attr_cfg in cat_config.get("attributes", []):
                # Determine which group this attribute belongs to
                group_id = group_map["general"]
                if "condition" in attr_cfg["slug"]:
                    group_id = group_map["condition"]
                elif any(x in attr_cfg["slug"] for x in ["processor", "ram", "storage", "screen", "graphics"]):
                    group_id = group_map["technical-specs"]
                elif "details" in cat_config["name"].lower():
                    group_id = group_map["details"]

                # Insert attribute
                attr_result = conn.execute(text("""
                    INSERT INTO attribute (attribute_group_id, name, slug, field_type, required)
                    VALUES (:group_id, :name, :slug, :field_type, :required)
                    ON CONFLICT (slug) DO UPDATE SET field_type = :field_type, required = :required
                    RETURNING id
                """), {
                    "group_id": group_id,
                    "name": attr_cfg["name"],
                    "slug": attr_cfg["slug"],
                    "field_type": attr_cfg["type"],
                    "required": attr_cfg.get("required", False)
                })

                attr_id = attr_result.scalar()
                attr_count += 1

                # Insert attribute options
                for idx, option in enumerate(attr_cfg.get("options", [])):
                    conn.execute(text("""
                        INSERT INTO attribute_option (attribute_id, value, display_name, sort_order)
                        VALUES (:attr_id, :value, :display_name, :sort_order)
                        ON CONFLICT DO NOTHING
                    """), {
                        "attr_id": attr_id,
                        "value": option.lower().replace(" ", "-"),
                        "display_name": option,
                        "sort_order": idx
                    })
                    option_count += 1

                # Assign attribute to category
                if isinstance(cat_id, int):
                    # Check if already exists
                    existing = conn.execute(text("""
                        SELECT id FROM category_attribute
                        WHERE category_id = :cat_id AND attribute_id = :attr_id
                    """), {"cat_id": int(cat_id), "attr_id": attr_id}).first()

                    if not existing:
                        conn.execute(text("""
                            INSERT INTO category_attribute (category_id, attribute_id, required, sort_order)
                            VALUES (:cat_id, :attr_id, :required, :sort_order)
                        """), {
                            "cat_id": int(cat_id),
                            "attr_id": attr_id,
                            "required": attr_cfg.get("required", False),
                            "sort_order": list(cat_config.get("attributes", [])).index(attr_cfg)
                        })

        conn.commit()
        print(f"✅ Created {attr_count} attributes")
        print(f"✅ Created {option_count} attribute options")
        print(f"\n✨ Attribute seeding complete!")


if __name__ == "__main__":
    try:
        print("🌱 Seeding attributes...\n")
        seed_attributes()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
