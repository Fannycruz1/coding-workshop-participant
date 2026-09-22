"""Request shapes for buildings, floors and seats.

The update models are all-optional on purpose: the handler uses
`exclude_unset` so a PATCH touches only the fields that were sent, and an
empty body comes back as a 400 rather than a silent no-op.
"""

from pydantic import BaseModel, Field


class BuildingCreate(BaseModel):
    name: str = Field(min_length=1)
    address: str | None = None


class BuildingUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    address: str | None = None


class FloorCreate(BaseModel):
    building_id: int
    floor_number: int
    name: str | None = None


class FloorUpdate(BaseModel):
    floor_number: int | None = None
    name: str | None = None


class SeatCreate(BaseModel):
    floor_id: int
    seat_code: str = Field(min_length=1)


class SeatUpdate(BaseModel):
    seat_code: str | None = Field(default=None, min_length=1)
