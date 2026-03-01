from pydantic import BaseModel
from typing import Optional


class PatientBase(BaseModel):
    name: str
    phone: str
    gender: Optional[str] = None
    age: Optional[int] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class PatientCreate(PatientBase):
    clinicId: Optional[str] = None


class PatientRegister(BaseModel):
    """Public self-registration — minimal required fields."""
    name: str
    phone: str
    age: Optional[int] = None
    gender: Optional[str] = None
    date: Optional[str] = None  # ISO format YYYY-MM-DD; defaults to today if omitted


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    email: Optional[str] = None
    notes: Optional[str] = None


class Patient(PatientBase):
    id: str
    clinicId: str
    visits: int = 0
    createdAt: Optional[str] = None

    model_config = {"from_attributes": True}
