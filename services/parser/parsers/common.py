import pandas as pd
from pandas import isna


TEMPLATES = {
    "skus_stock": {"sku", "stock"},
    "margenes": {"sku", "costo", "precio", "margen"},
    "ficha_tecnica": {"sku", "titulo", "descripcion"},
}


def normalize_columns(columns):
    return [str(column).strip().lower().replace(" ", "_") for column in columns]


def read_table(path: str, filename: str):
    if filename.endswith(".csv"):
        return pd.read_csv(path)
    if filename.endswith(".ods"):
        return pd.read_excel(path, engine="odf")
    return pd.read_excel(path)


def detect_template(columns):
    column_set = set(normalize_columns(columns))
    for name, required in TEMPLATES.items():
        if required.issubset(column_set):
            return name, []
    missing = [f"{name}: faltan {', '.join(sorted(required - column_set))}" for name, required in TEMPLATES.items()]
    return "otro", missing


def clean_value(value):
    if isna(value):
        return None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def number_value(row, column, errors, row_number, required=False):
    value = clean_value(row.get(column))
    if value is None:
        if required:
            errors.append(f"fila {row_number}: {column} vacío")
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        errors.append(f"fila {row_number}: {column} inválido")
        return None


def text_value(row, column, errors, row_number, required=False):
    value = clean_value(row.get(column))
    if value is None:
        if required:
            errors.append(f"fila {row_number}: {column} vacío")
        return None
    return str(value)


def parse_records(df, template_type):
    errors = []
    records = []
    df = df.where(pd.notnull(df), None)

    for index, row in df.iterrows():
        row_number = index + 2
        sku = text_value(row, "sku", errors, row_number, required=True)
        if not sku:
            continue

        if template_type == "skus_stock":
            records.append({
                "sku": sku,
                "stock": number_value(row, "stock", errors, row_number, required=True),
            })
            continue

        if template_type == "margenes":
            records.append({
                "sku": sku,
                "costo": number_value(row, "costo", errors, row_number, required=True),
                "precio": number_value(row, "precio", errors, row_number, required=True),
                "margen": number_value(row, "margen", errors, row_number, required=True),
            })
            continue

        if template_type == "ficha_tecnica":
            reserved = {"sku", "titulo", "descripcion"}
            attributes = {
                column: clean_value(row.get(column))
                for column in df.columns
                if column not in reserved and clean_value(row.get(column)) is not None
            }
            records.append({
                "sku": sku,
                "titulo": text_value(row, "titulo", errors, row_number, required=True),
                "descripcion": text_value(row, "descripcion", errors, row_number, required=True),
                "attributes": attributes,
            })

    return records, errors
