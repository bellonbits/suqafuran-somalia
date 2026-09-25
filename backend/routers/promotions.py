from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from typing import Optional

router = APIRouter(prefix="/promotions", tags=["promotions"])


@router.get("/agent/signups")
def get_agent_signups(
    search: Optional[str] = Query(None),
    limit: int = Query(80, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get user signups with their ad counts from users table"""
    try:
        if search:
            search_term = f"%{search}%"
            query_text = text("""
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    u.phone,
                    u.created_at,
                    u.is_active,
                    COALESCE(COUNT(l.id), 0) as ad_count,
                    CASE WHEN COUNT(l.id) > 0 THEN true ELSE false END as has_posted
                FROM "user" u
                LEFT JOIN listing l ON u.id = l.owner_id
                WHERE (u.email ILIKE :search OR u.full_name ILIKE :search)
                GROUP BY u.id, u.full_name, u.email, u.phone, u.created_at, u.is_active
                ORDER BY u.created_at DESC
                LIMIT :limit
            """)
            result = db.execute(query_text, {"search": search_term, "limit": limit})
        else:
            query_text = text("""
                SELECT
                    u.id,
                    u.full_name,
                    u.email,
                    u.phone,
                    u.created_at,
                    u.is_active,
                    COALESCE(COUNT(l.id), 0) as ad_count,
                    CASE WHEN COUNT(l.id) > 0 THEN true ELSE false END as has_posted
                FROM "user" u
                LEFT JOIN listing l ON u.id = l.owner_id
                GROUP BY u.id, u.full_name, u.email, u.phone, u.created_at, u.is_active
                ORDER BY u.created_at DESC
                LIMIT :limit
            """)
            result = db.execute(query_text, {"limit": limit})

        signups = []
        for row in result:
            signup = {
                "id": row[0],
                "full_name": row[1] or "—",
                "email": row[2],
                "phone": row[3],
                "created_at": row[4].isoformat() if row[4] else None,
                "is_active": row[5],
                "ad_count": int(row[6]),
                "has_posted": row[7]
            }
            signups.append(signup)
        return signups

    except Exception as e:
        print(f"Error fetching signups: {e}")
        return []
