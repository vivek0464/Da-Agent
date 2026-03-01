from pydantic import BaseModel
from typing import Optional, List


class TimeSlot(BaseModel):
    start: str
    end: str


class AvailabilityBase(BaseModel):
    doctorId: str
    date: str
    slots: List[TimeSlot] = []
    recurring: bool = False
    dayOfWeek: Optional[int] = None


class AvailabilityCreate(AvailabilityBase):
    clinicId: str


class AvailabilityUpdate(BaseModel):
    slots: Optional[List[TimeSlot]] = None
    recurring: Optional[bool] = None
    dayOfWeek: Optional[int] = None


class Availability(AvailabilityBase):
    id: str
    clinicId: str

    model_config = {"from_attributes": True}
