"""Request/response shapes. Duplicated per Lambda folder — keep identical across services."""

from typing import Literal

from pydantic import BaseModel, Field

# All three mirror db/schema.sql's enums.
Category = Literal[
    "HVAC", "Electrical", "Plumbing", "Furniture", "Network",
    "AV/Conference Room", "Printer", "Access/Badge", "Cleaning", "Other",
]
Priority = Literal["Low", "Medium", "High", "Critical"]
Status = Literal["Open", "In Progress", "Blocked", "Resolved", "Closed"]


class IncidentCreate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    category: Category
    priority: Priority = "Medium"
    building_id: int
    floor_id: int
    seat_id: int | None = None


class IncidentFilters(BaseModel):
    """GET /incidents query params. Unknown enum values come back as a 400."""

    # Capped by default: the list feeds a dashboard that renders every row it
    # is handed, and the seed alone holds hundreds. Narrow with the filters.
    limit: int = Field(default=50, ge=1, le=200)

    status: Status | None = None
    category: Category | None = None
    priority: Priority | None = None
    building_id: int | None = None
    assigned_to: int | None = None
    q: str | None = None


class StatusChange(BaseModel):
    to_status: Status
    reason: str | None = None


class AssignRequest(BaseModel):
    # Omitted means "me", which is how an engineer claims an unassigned incident.
    engineer_id: int | None = None


class NoteCreate(BaseModel):
    body: str = Field(min_length=1)


class EscalationCreate(BaseModel):
    requested_priority: Priority
    reason: str = Field(min_length=1)
    # current_priority is deliberately absent: it is read from the row on the
    # server, never accepted from the client, or the CHECK could be dodged.


class EscalationDecision(BaseModel):
    decision: Literal["approve", "reject"]
