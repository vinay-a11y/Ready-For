from pydantic import BaseModel
from typing import List, Literal

class KitchenVariant(BaseModel):
    variant: str
    quantity: int
    weight: int
    pieces: int = 0


class KitchenPrepItem(BaseModel):
    name: str
    totalQuantity: int
    totalWeight: int
    totalPieces: int = 0
    orderCount: int
    variants: List[KitchenVariant]
    priority: Literal["high", "medium", "low"]
    estimatedPrepTime: int
