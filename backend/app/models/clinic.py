from pydantic import BaseModel
from typing import Optional


class ClinicBase(BaseModel):
    name: str
    address: str
    phone: str


class ClinicCreate(ClinicBase):
    pass


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class Clinic(ClinicBase):
    id: str
    slug: Optional[str] = None
    qrCodeUrl: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = {"from_attributes": True}


class DoctorBase(BaseModel):
    name: str
    email: str
    phone: str
    role: str = "doctor"
    specialization: Optional[str] = None


class DoctorCreate(DoctorBase):
    password: Optional[str] = None


class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None


class Doctor(DoctorBase):
    id: str
    clinicId: str
    firebaseUid: Optional[str] = None
    createdAt: Optional[str] = None

    model_config = {"from_attributes": True}


class StaffBase(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    role: str = "staff"


class StaffCreate(StaffBase):
    pass


class Staff(StaffBase):
    id: str
    clinicId: str
    firebaseUid: Optional[str] = None
    createdAt: Optional[str] = None

    model_config = {"from_attributes": True}
