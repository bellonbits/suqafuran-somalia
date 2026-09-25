from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, Float

if TYPE_CHECKING:
    from app.models.user import User

class AdminAreaType(str):
    STATE = "state"
    REGION = "region"
    DISTRICT = "district"

class AdminArea(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    level: str = Field(index=True)  # state, region, district
    parent_id: Optional[int] = Field(default=None, foreign_key="adminarea.id")
    
    # Relationships
    children: List["AdminArea"] = Relationship(back_populates="parent")
    parent: Optional["AdminArea"] = Relationship(back_populates="children", sa_relationship_kwargs={"remote_side": "AdminArea.id"})
    places: List["Place"] = Relationship(back_populates="admin_area")
    emergency_contacts: List["EmergencyContact"] = Relationship(back_populates="admin_area")

class Place(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    type: str = Field(default="city")  # city, town, village
    latitude: float
    longitude: float
    admin_area_id: int = Field(foreign_key="adminarea.id")
    
    admin_area: AdminArea = Relationship(back_populates="places")
    landmarks: List["Landmark"] = Relationship(back_populates="place")
    pins: List["KaalayHeedhePin"] = Relationship(back_populates="place")

class Landmark(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    category: str = Field(index=True)  # mall, mosque, hospital, etc.
    latitude: float
    longitude: float
    is_verified: bool = Field(default=False)
    place_id: int = Field(foreign_key="place.id")
    
    place: Place = Relationship(back_populates="landmarks")
    pins: List["KaalayHeedhePin"] = Relationship(back_populates="landmark")

class KaalayHeedhePin(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)  # KH-XXXX format
    latitude: float
    longitude: float
    
    # Friendly metadata
    landmark_id: Optional[int] = Field(default=None, foreign_key="landmark.id")
    place_id: int = Field(foreign_key="place.id")
    
    # Optional owner (linked to user)
    owner_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    privacy_level: str = Field(default="public")  # public, private
    
    place: Place = Relationship(back_populates="pins")
    landmark: Optional[Landmark] = Relationship(back_populates="pins")

class EmergencyContact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    service_type: str = Field(index=True)  # police, fire, medical
    phone_number: str
    admin_area_id: Optional[int] = Field(default=None, foreign_key="adminarea.id")
    
    admin_area: Optional[AdminArea] = Relationship(back_populates="emergency_contacts")
