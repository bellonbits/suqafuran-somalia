from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from app.api import deps
from app.models.report import SalesReport, SalesReportCreate, ReportStatsRead
from app.models.user import User

router = APIRouter()


@router.get("/stats", response_model=ReportStatsRead)
def get_report_stats(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get report statistics for the current seller.
    """
    # Count total reports
    total_reports = db.exec(
        select(func.count(SalesReport.id)).where(SalesReport.seller_id == current_user.id)
    ).one()

    # Get last generated report
    last_report = db.exec(
        select(SalesReport)
        .where(SalesReport.seller_id == current_user.id)
        .order_by(SalesReport.last_generated.desc())
    ).first()

    last_generated = last_report.last_generated if last_report else None
    report_size = last_report.report_size if last_report else 0

    return ReportStatsRead(
        total_reports=total_reports,
        last_generated=last_generated,
        report_size=report_size,
    )


@router.post("/generate", response_model=SalesReport)
def generate_report(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    report_in: SalesReportCreate,
) -> Any:
    """
    Generate a new report by type (sales, inventory, earnings, etc).
    """
    # Create new report
    report = SalesReport(
        seller_id=current_user.id,
        report_type=report_in.report_type,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # In a real scenario, this would trigger an async job to generate the report
    # For now, we'll mark it as completed immediately
    report.status = "completed"
    report.last_generated = datetime.utcnow()
    report.report_size = 1024  # Mock size in bytes

    db.add(report)
    db.commit()
    db.refresh(report)

    return report


@router.get("", response_model=List[SalesReport])
def list_reports(
    *,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    List reports for the current seller (paginated).
    """
    statement = (
        select(SalesReport)
        .where(SalesReport.seller_id == current_user.id)
        .order_by(SalesReport.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    reports = db.exec(statement).all()
    return reports
