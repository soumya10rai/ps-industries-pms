"""
Pydantic schemas for Purchase Order parsing and Firestore /po_uploads docs.

Used by scripts/parse_po.py for validation before writing normalized JSON.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ParseSource(str, Enum):
    """How the PO document was resolved."""

    PDF = "pdf"
    EXCEL = "excel"
    FIXTURE = "fixture"
    MANUAL = "manual"


class POItem(BaseModel):
    """Single line item on a purchase order."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    item_code: str = Field(..., min_length=1, description="Customer / ERP item code")
    description: str = Field(..., min_length=1)
    part_code: Optional[str] = Field(
        default=None,
        description="Vendor or customer part number when distinct from item_code",
    )
    quantity: float = Field(..., gt=0)
    uom: str = Field(default="NOS", min_length=1)
    rate: float = Field(..., ge=0, description="Unit rate in INR")
    total: float = Field(..., ge=0, description="Line total (qty × rate) in INR")
    material_grade: Optional[str] = Field(
        default=None,
        description="Filled later from Setup / BOM sheet",
    )
    colour: Optional[str] = Field(
        default=None,
        description="Colour / finish when present on the PO",
    )

    @field_validator("uom", mode="before")
    @classmethod
    def normalize_uom(cls, value: Any) -> str:
        if value is None or str(value).strip() == "":
            return "NOS"
        text = str(value).strip().upper()
        # BMR uses "NO"; normalize to NOS
        if text in {"NO", "NOS", "PCS", "PC", "EA", "EACH"}:
            return "NOS" if text in {"NO", "NOS"} else text
        return text

    @field_validator("part_code", "colour", "material_grade", mode="before")
    @classmethod
    def empty_optional_to_none(cls, value: Any) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def reconcile_total(self) -> "POItem":
        expected = round(self.quantity * self.rate, 2)
        # Allow 1 INR float tolerance for Indian PO rounding
        if abs(self.total - expected) > 1.0:
            object.__setattr__(self, "total", expected)
        return self


class PurchaseOrder(BaseModel):
    """Normalized purchase order ready for /po_uploads."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    po_number: str = Field(..., min_length=1)
    po_date: str = Field(..., description="ISO date YYYY-MM-DD")
    customer_code: str = Field(
        ...,
        min_length=1,
        max_length=16,
        description="Short code for customer master lookup (BMR, KENT, PREM)",
    )
    customer_name: str = Field(..., min_length=1)
    delivery_date: Optional[str] = Field(
        default=None,
        description="ISO date YYYY-MM-DD when known",
    )
    payment_terms: Optional[str] = None
    items: list[POItem] = Field(..., min_length=1)
    total_amount: float = Field(..., ge=0)
    gst: Optional[str] = Field(
        default=None,
        description='e.g. "AS APPLICABLE", "18%", or null',
    )

    # Metadata for Firestore / server pipeline (optional for fixtures)
    source_file: Optional[str] = None
    parse_source: Optional[ParseSource] = None
    parsed_at: Optional[str] = None

    @field_validator("customer_code", mode="before")
    @classmethod
    def uppercase_code(cls, value: Any) -> str:
        return str(value).strip().upper()

    @field_validator("po_date", "delivery_date", mode="before")
    @classmethod
    def normalize_date(cls, value: Any) -> Optional[str]:
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return value.date().isoformat()
        if isinstance(value, date):
            return value.isoformat()
        text = str(value).strip()
        # Already ISO
        if len(text) == 10 and text[4] == "-" and text[7] == "-":
            date.fromisoformat(text)  # validate
            return text
        # DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
        for sep in (".", "/", "-"):
            parts = text.split(sep)
            if len(parts) == 3 and len(parts[2]) == 4:
                day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                return date(year, month, day).isoformat()
        raise ValueError(f"Unrecognized date format: {value!r}")

    @model_validator(mode="after")
    def reconcile_header_total(self) -> "PurchaseOrder":
        items_sum = round(sum(i.total for i in self.items), 2)
        if abs(self.total_amount - items_sum) > 1.0:
            object.__setattr__(self, "total_amount", items_sum)
        return self

    def to_firestore_dict(self) -> dict[str, Any]:
        """JSON-serializable dict for Firestore /po_uploads."""
        data = self.model_dump(mode="json", exclude_none=False)
        if not data.get("parsed_at"):
            data["parsed_at"] = datetime.now(timezone.utc).isoformat()
        return data


class POParseResult(BaseModel):
    """Wrapper returned by the parser CLI / API."""

    model_config = ConfigDict(extra="forbid")

    success: bool
    purchase_order: Optional[PurchaseOrder] = None
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
