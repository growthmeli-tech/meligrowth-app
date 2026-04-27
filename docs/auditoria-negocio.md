## Scoring global y pesos

- **Estado**: PARCIAL
- **Evidencia**: `lib/scoring.ts`
- **Resultado**:
  - Caso normal: pesos 35/20/20/15/10, suma 100%.
  - Sin Ads: redistribucion 43.75/25/0/18.75/12.5, suma 100%.
  - Riesgo funcional: en formulario legacy se completan nulls con `0`, por lo que "sin datos Ads" puede terminar penalizando en vez de excluirse.

## Benchmarks vs contexto de producto

- **Estado**: NO CUMPLE
- **Evidencia**: `lib/recommendations/benchmarks.ts` vs `docs/meligrowth-product-context.md`
- **Desvios detectados**:
  - `reclamos`: para score 85 el contexto define `<0.5`, el benchmark actual usa tramo hasta `0.8`.
  - `pubs_activas_pct`: contexto define score 85 para `>65`, pero el score en `lib/scoring.ts` usa umbrales de otra escala (`platinum 95`, `solid 85`).
  - `roas`: contexto define 100 en `>8x`; scoring usa platinum en `10`.
- **Impacto**: la cuenta puede tener score de bloque y recomendacion con lectura contradictoria.

## Audiencias de alertas (`internal/manager/operator/all`)

- **Estado**: PARCIAL
- **Evidencia**: `lib/recommendations/engine.ts`, `lib/recommendations/persist.ts`, `supabase/migrations/0004_new_model_360.sql`
- **Resultado**:
  - El motor ya asigna audiencias v2 (`internal`, `manager`, `operator`, `all`).
  - Se persisten solo prioridades `urgente` y `alta`; `media`/`baja` quedan en memoria.
  - En UI brand/ops se filtra por audiencia correcta, pero el motor sigue tipado sobre `diagnostics` legacy como input.

## Diferenciacion 360 vs Copilot en permisos y vistas

- **Estado**: NO CUMPLE
- **Evidencia**: `middleware.ts`, `app/(ops)/ops/*`, `docs/meligrowth-product-context.md`
- **Resultado**:
  - En visual, la UI distingue plan (`360`/`360_copilot`) con badges y cards.
  - En permisos, `/ops/**` no contempla operador interno MG para Copilot.
  - No hay decision runtime por `companies.plan` para alternar comportamiento operativo.

## Conclusiones de negocio

- El proyecto tiene buena base v2 de datos y UI, pero la logica efectiva de negocio aun esta repartida entre v2 y legacy.
- Para operar 360/Copilot con consistencia real falta unificar benchmarks y cerrar la brecha de permisos por plan.
