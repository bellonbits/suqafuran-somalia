import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.db.session import get_db
from app.models.kh_models import KaalayHeedhePin, Landmark, Place, AdminArea, EmergencyContact
from app.api import deps
from app.models.user import User
from pydantic import BaseModel

router = APIRouter()


# Schemas
class PinCreate(BaseModel):
    latitude: float
    longitude: float
    landmark_id: Optional[int] = None
    place_id: Optional[int] = None
    privacy_level: str = "public"


class PinRead(BaseModel):
    code: str
    latitude: float
    longitude: float
    landmark_name: Optional[str] = None
    place_name: str
    district_name: Optional[str] = None
    city_name: Optional[str] = None


class NearbyLandmark(BaseModel):
    id: int
    name: str
    category: str
    latitude: float
    longitude: float
    distance: float


def generate_kh_code(session: Session) -> str:
    """Generates a unique KH-XXXX code."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):
        code = f"KH-{''.join(random.choice(chars) for _ in range(4))}"
        statement = select(KaalayHeedhePin).where(KaalayHeedhePin.code == code)
        if not session.exec(statement).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique PIN")


@router.post("/pin", response_model=KaalayHeedhePin)
def create_pin(
    *,
    session: Session = Depends(get_db),
    pin_in: PinCreate,
    current_user: User = Depends(deps.get_current_active_user)
):
    """Create a new location PIN."""
    code = generate_kh_code(session)
    
    # Validate or find place_id
    place_id = pin_in.place_id
    if place_id:
        db_place = session.get(Place, place_id)
        if not db_place:
            place_id = None
            
    if not place_id:
        # Fallback: Find nearest place
        # Using a simple bounding box or distance search
        radius = 0.5 # About 50km
        statement = select(Place).where(
            Place.latitude.between(pin_in.latitude - radius, pin_in.latitude + radius),
            Place.longitude.between(pin_in.longitude - radius, pin_in.longitude + radius)
        )
        places = session.exec(statement).all()
        if places:
            # Pick the closest one
            closest_place = min(places, key=lambda p: (p.latitude - pin_in.latitude)**2 + (p.longitude - pin_in.longitude)**2)
            place_id = closest_place.id
        else:
            # absolute fallback: pick the first available place in DB if any
            first_place = session.exec(select(Place)).first()
            if first_place:
                place_id = first_place.id
            else:
                raise HTTPException(status_code=400, detail="No valid city/place found in database. Please seed geographic data.")

    db_pin = KaalayHeedhePin(
        code=code,
        latitude=pin_in.latitude,
        longitude=pin_in.longitude,
        landmark_id=pin_in.landmark_id,
        place_id=place_id,
        owner_id=current_user.id,
        privacy_level=pin_in.privacy_level
    )
    session.add(db_pin)
    session.commit()
    session.refresh(db_pin)
    return db_pin


@router.get("/pin/{code}", response_model=PinRead)
def get_pin_details(
    *,
    session: Session = Depends(get_db),
    code: str
):
    """Retrieve PIN location details."""
    statement = select(KaalayHeedhePin).where(KaalayHeedhePin.code == code)
    pin = session.exec(statement).first()
    if not pin:
        raise HTTPException(status_code=404, detail="PIN not found")

    place = session.get(Place, pin.place_id)
    landmark = session.get(Landmark, pin.landmark_id) if pin.landmark_id else None

    return PinRead(
        code=pin.code,
        latitude=pin.latitude,
        longitude=pin.longitude,
        landmark_name=landmark.name if landmark else None,
        place_name=place.name if place else "Unknown",
        district_name=place.admin_area.name if place and place.admin_area and place.admin_area.level == "district" else None,
        city_name=place.name if place and place.type == "city" else None
    )


@router.get("/search")
def search_kaalay_heedhe(
    *,
    session: Session = Depends(get_db),
    q: str = Query(..., min_length=2)
):
    """Search by PIN, Landmark, or City."""
    pins = session.exec(select(KaalayHeedhePin).where(KaalayHeedhePin.code.ilike(f"%{q}%"))).all()
    landmarks = session.exec(select(Landmark).where(Landmark.name.ilike(f"%{q}%"))).all()
    places = session.exec(select(Place).where(Place.name.ilike(f"%{q}%"))).all()

    return {
        "pins": pins[:5],
        "landmarks": landmarks[:5],
        "places": places[:5]
    }


@router.get("/nearby", response_model=List[NearbyLandmark])
def get_nearby_landmarks(
    *,
    session: Session = Depends(get_db),
    lat: float,
    lng: float,
    radius: float = 0.05
):
    """Get nearby landmarks based on coordinates."""
    statement = select(Landmark).where(
        Landmark.latitude.between(lat - radius, lat + radius),
        Landmark.longitude.between(lng - radius, lng + radius)
    )
    landmarks = session.exec(statement).all()

    results = []
    for lm in landmarks:
        dist = ((lm.latitude - lat)**2 + (lm.longitude - lng)**2)**0.5
        results.append(NearbyLandmark(
            id=lm.id,
            name=lm.name,
            category=lm.category,
            latitude=lm.latitude,
            longitude=lm.longitude,
            distance=dist * 111.32
        ))

    return sorted(results, key=lambda x: x.distance)[:10]


@router.get("/emergency")
def get_emergency_contacts(
    *,
    session: Session = Depends(get_db),
    district_id: Optional[int] = None
):
    """Fetch emergency contacts."""
    if district_id:
        statement = select(EmergencyContact).where(EmergencyContact.admin_area_id == district_id)
    else:
        statement = select(EmergencyContact)

    return session.exec(statement).all()
