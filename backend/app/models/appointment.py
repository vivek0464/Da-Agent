from pydantic import BaseModel
from typing import Optional
from enum import Enum


class AppointmentStatus(str, Enum):
    scheduled = "scheduled"
    in_progress = "in-progress"
    completed = "completed"
    cancelled = "cancelled"


class AppointmentBase(BaseModel):
    patientName: str
    patientPhone: str
    patientEmail: Optional[str] = None
    date: str
    timeSlot: str
    doctorId: str
    patientId: Optional[str] = None


class AppointmentCreate(AppointmentBase):
    clinicId: str


class AppointmentUpdate(BaseModel):
    status: Optional[AppointmentStatus] = None
    queuePosition: Optional[int] = None
    estimatedTime: Optional[str] = None
    patientId: Optional[str] = None
    doctorId: Optional[str] = None
    date: Optional[str] = None
    timeSlot: Optional[str] = None


class Appointment(AppointmentBase):
    id: str
    clinicId: str
    queuePosition: int = 0
    status: AppointmentStatus = AppointmentStatus.scheduled
    estimatedTime: Optional[str] = None
    createdAt: Optional[str] = None

    model_config = {"from_attributes": True}


class QueueReorderRequest(BaseModel):
    orderedIds: list[str]
