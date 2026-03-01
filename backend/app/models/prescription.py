from pydantic import BaseModel
from typing import Optional, List


class Medication(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str


class PrescriptionContent(BaseModel):
    patientInfo: dict = {}
    complaints: List[str] = []
    diagnosis: List[str] = []
    medications: List[Medication] = []
    tests: List[str] = []
    followUp: str = ""
    notes: str = ""


class PrescriptionBase(BaseModel):
    patientId: str
    doctorId: str
    appointmentId: Optional[str] = None
    content: PrescriptionContent = PrescriptionContent()
    status: str = "draft"


class PrescriptionCreate(PrescriptionBase):
    clinicId: str


class PrescriptionUpdate(BaseModel):
    content: Optional[PrescriptionContent] = None
    status: Optional[str] = None


class Prescription(PrescriptionBase):
    id: str
    clinicId: str
    date: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    model_config = {"from_attributes": True}
