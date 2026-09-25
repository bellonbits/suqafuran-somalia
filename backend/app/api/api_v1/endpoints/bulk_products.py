"""Bulk product management endpoints."""

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from app.api import deps
from app.models.listing import Listing, Category
from app.models.bulk import ProductTitleChange, ProductFieldChange
from app.models.user import User
from app.services.title_suggester import TitleSuggester

router = APIRouter()
title_suggester = TitleSuggester()

# Columns of the category bulk-edit CSV -- exported and re-imported as-is.
# "category" and "status" are informational only; edits to them are ignored
# on import since the whole point is to scope the file to one category.
BULK_EDIT_CSV_FIELDS = ["id", "title", "price", "description", "stock", "category", "status"]


class ProductForSuggestion(BaseModel):
    id: str
    current_title: str
    category: str
    brand: str


class SuggestTitlesRequest(BaseModel):
    products: List[ProductForSuggestion]
    template: str = "{brand} {category} - {feature}, {color}"


class BulkUpdateRequest(BaseModel):
    updates: List[dict]  # [{"id": "...", "new_title": "..."}, ...]


@router.post("/suggest-titles")
async def suggest_titles(
    request: SuggestTitlesRequest,
    db: Session = Depends(deps.get_db),
):
    """Generate AI-powered title suggestions for products."""

    suggestions = {}

    for product in request.products:
        try:
            suggestion = title_suggester.generate_title(
                current_title=product.current_title,
                category=product.category,
                brand=product.brand,
                template=request.template,
            )
            suggestions[product.id] = suggestion
        except Exception as e:
            # Fallback to current title if suggestion fails
            suggestions[product.id] = product.current_title

    return {
        "suggestions": suggestions,
        "count": len(suggestions),
    }


@router.post("/bulk-update")
async def bulk_update_titles(
    request: BulkUpdateRequest,
    db: Session = Depends(deps.get_db),
):
    """Apply bulk title updates to listings."""

    updated_count = 0

    for update in request.updates:
        listing_id = update.get("id")
        new_title = update.get("new_title")

        if not listing_id or not new_title:
            continue

        # Get listing
        listing = db.exec(
            select(Listing).where(Listing.id == listing_id)
        ).first()

        if not listing:
            continue

        # Store old title for audit trail
        old_title = listing.title

        # Update title
        listing.title = new_title
        listing.updated_at = datetime.utcnow()

        # Log change
        change = ProductTitleChange(
            listing_id=listing_id,
            old_title=old_title,
            new_title=new_title,
            changed_at=datetime.utcnow(),
        )
        db.add(change)

        updated_count += 1

    db.commit()

    return {
        "success": True,
        "updated_count": updated_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/title-history/{listing_id}")
async def get_title_history(
    listing_id: str,
    db: Session = Depends(deps.get_db),
):
    """Get title change history for a specific product."""

    changes = db.exec(
        select(ProductTitleChange)
        .where(ProductTitleChange.listing_id == listing_id)
        .order_by(ProductTitleChange.changed_at.desc())
    ).all()

    return {
        "listing_id": listing_id,
        "history": [
            {
                "old_title": change.old_title,
                "new_title": change.new_title,
                "changed_at": change.changed_at.isoformat(),
            }
            for change in changes
        ],
        "total_changes": len(changes),
    }


@router.get("/bulk-export-by-category")
def bulk_export_by_category(
    *,
    db: Session = Depends(deps.get_db),
    category_id: int,
    current_user: User = Depends(deps.get_current_active_superuser),
):
    """
    Export every listing in a category as a CSV -- title, price, description
    and stock, ready to edit in a spreadsheet and re-upload via
    /bulk-edit-by-category. Admin only: this covers every seller's listings
    in the category, not just one shop's.
    """
    category = db.exec(select(Category).where(Category.id == category_id)).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    listings = db.exec(
        select(Listing).where(Listing.category_id == category_id).order_by(Listing.id)
    ).all()

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=BULK_EDIT_CSV_FIELDS)
    writer.writeheader()
    for listing in listings:
        writer.writerow({
            "id": listing.id,
            "title": listing.title_en,
            "price": listing.price,
            "description": listing.description_en,
            "stock": (listing.attributes or {}).get("stock", ""),
            "category": category.name_en,
            "status": listing.status,
        })

    buffer.seek(0)
    filename = f"{category.slug}-bulk-edit-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/bulk-edit-by-category")
async def bulk_edit_by_category(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_superuser),
):
    """
    Re-import a CSV downloaded from /bulk-export-by-category (after editing
    title/price/description/stock) and apply the changes. Matches rows to
    listings by id; only fields that actually changed are written and logged
    to product_field_changes, one row per field per listing.
    """
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(raw))

    def col(row: dict, *names: str) -> str:
        # Accepts either this endpoint's own export column names (title,
        # description) or AdminListingsPage's richer export (title_en,
        # description_en) -- whichever CSV the admin re-uploads works.
        for name in names:
            value = row.get(name)
            if value:
                return value.strip()
        return ""

    updated_listings = 0
    field_changes = 0
    errors: List[dict] = []

    for row_num, row in enumerate(reader, start=2):
        listing_id_raw = col(row, "id")
        if not listing_id_raw:
            continue
        try:
            listing_id = int(listing_id_raw)
        except ValueError:
            errors.append({"row": row_num, "message": f"Invalid id '{listing_id_raw}'"})
            continue

        listing = db.exec(select(Listing).where(Listing.id == listing_id)).first()
        if not listing:
            errors.append({"row": row_num, "message": f"Listing {listing_id} not found"})
            continue

        row_changed = False

        new_title = col(row, "title", "title_en")
        if new_title and new_title != listing.title_en:
            db.add(ProductFieldChange(
                listing_id=listing_id, field="title",
                old_value=listing.title_en, new_value=new_title,
                changed_by=current_user.id,
            ))
            listing.title_en = new_title
            row_changed = True
            field_changes += 1

        new_price_raw = col(row, "price")
        if new_price_raw:
            try:
                new_price = float(new_price_raw)
                if new_price != listing.price:
                    db.add(ProductFieldChange(
                        listing_id=listing_id, field="price",
                        old_value=str(listing.price), new_value=str(new_price),
                        changed_by=current_user.id,
                    ))
                    listing.price = new_price
                    row_changed = True
                    field_changes += 1
            except ValueError:
                errors.append({"row": row_num, "message": f"Invalid price '{new_price_raw}'"})

        new_description = col(row, "description", "description_en")
        if new_description and new_description != listing.description_en:
            db.add(ProductFieldChange(
                listing_id=listing_id, field="description",
                old_value=listing.description_en, new_value=new_description,
                changed_by=current_user.id,
            ))
            listing.description_en = new_description
            row_changed = True
            field_changes += 1

        new_stock_raw = col(row, "stock")
        if new_stock_raw:
            old_stock = str((listing.attributes or {}).get("stock", ""))
            if new_stock_raw != old_stock:
                db.add(ProductFieldChange(
                    listing_id=listing_id, field="stock",
                    old_value=old_stock, new_value=new_stock_raw,
                    changed_by=current_user.id,
                ))
                listing.attributes = {**(listing.attributes or {}), "stock": new_stock_raw}
                row_changed = True
                field_changes += 1

        if row_changed:
            listing.updated_at = datetime.utcnow()
            db.add(listing)
            updated_listings += 1

    db.commit()

    return {
        "success": True,
        "updated_listings": updated_listings,
        "field_changes": field_changes,
        "errors": errors,
        "timestamp": datetime.utcnow().isoformat(),
    }
