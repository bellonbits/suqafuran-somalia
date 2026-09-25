from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class SalesReportBase(SQLModel):
    seller_id: int = Field(foreign_key="user.id", index=True)
    report_type: str  # sales, inventory, earnings, etc.
    status: str = Field(default="pending")  # pending, completed, failed


class SalesReport(SalesReportBase, table=True):
    __tablename__ = "sales_report"
    id: Optional[int] = Field(default=None, primary_key=True)
    last_generated: Optional[datetime] = None
    report_size: int = Field(default=0)  # Size in bytes
    file_path: Optional[str] = None  # Path to generated report file
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SalesReportCreate(SQLModel):
    report_type: str


class SalesReportRead(SalesReport):
    pass


class ReportStatsRead(SQLModel):
    total_reports: int
    last_generated: Optional[datetime]
    report_size: int


class ListingReportBase(SQLModel):
    listing_id: int = Field(foreign_key="listing.id", index=True)
    reporter_id: int = Field(foreign_key="user.id", index=True)
    reason: str
    description: Optional[str] = None
    status: str = Field(default="pending")


class ListingReport(ListingReportBase, table=True):
    __tablename__ = "listing_report"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ListingReportCreate(SQLModel):
    listing_id: int
    reason: str
    description: Optional[str] = None


class ListingReportRead(ListingReport):
    pass
