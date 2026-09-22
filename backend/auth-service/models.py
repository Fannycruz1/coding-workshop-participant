"""Request/response shapes. Duplicated per Lambda folder — keep identical across services."""

from typing import Literal

from pydantic import BaseModel, Field

# Mirrors db/schema.sql's user_role enum, minus 'engineer': engineers are
# created by an admin, never self-registered.
SelfServeRole = Literal["employee", "facility_admin"]

# db/schema.sql's incident_category enum, reused as an engineer's specialty.
Specialty = Literal[
    "HVAC", "Electrical", "Plumbing", "Furniture", "Network",
    "AV/Conference Room", "Printer", "Access/Badge", "Cleaning", "Other",
]


class LoginRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)


class RegisterRequest(LoginRequest):
    full_name: str = Field(min_length=1)
    role: SelfServeRole


class EngineerCreateRequest(BaseModel):
    email: str = Field(min_length=1)
    password: str = Field(min_length=1)
    full_name: str = Field(min_length=1)
    specialty: Specialty
    phone: str | None = None


class EngineerUpdate(BaseModel):
    """PATCH /engineers/{id}. Both optional; an empty body is a 400, not a no-op."""

    specialty: Specialty | None = None
    phone: str | None = None


class UserPublic(BaseModel):
    """The users columns safe to return — no password, ever."""

    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
