import os
import tempfile
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from parsers.common import detect_template, normalize_columns, parse_records, read_table
from models import ParseResult

app = FastAPI(title="MeliGrowth Parser Service")


def assert_secret(secret: str | None):
    expected = os.getenv("PARSER_SERVICE_SECRET")
    if expected and secret != expected:
        raise HTTPException(status_code=401, detail="Invalid parser secret")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/parse", response_model=ParseResult)
async def parse_file(file: UploadFile = File(...), x_parser_secret: str | None = Header(default=None)):
    assert_secret(x_parser_secret)
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in {".csv", ".xlsx", ".ods"}:
        raise HTTPException(status_code=400, detail="Formato no soportado")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        df = read_table(tmp_path, file.filename or "")
        df.columns = normalize_columns(df.columns)
        tipo, errors = detect_template(df.columns)
        data = []
        if not errors and tipo != "otro":
            data, row_errors = parse_records(df, tipo)
            errors.extend(row_errors)
        return ParseResult(tipo=tipo, rows=len(data), columns=list(df.columns), data=data, errors=errors)
    finally:
        os.unlink(tmp_path)
