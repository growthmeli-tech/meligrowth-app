from pydantic import BaseModel


class ParseResult(BaseModel):
    tipo: str
    rows: int
    columns: list[str]
    data: list[dict] = []
    errors: list[str] = []
