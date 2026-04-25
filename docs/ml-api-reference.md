# Referencia de APIs de Mercado Libre — Meli Growth
# Última actualización: Abril 2026
# Base URL: https://api.mercadolibre.com
# Auth: Bearer {access_token} en todos los endpoints

---

## AUTENTICACIÓN

### OAuth 2.0
POST https://api.mercadolibre.com/oauth/token
  grant_type=authorization_code | refresh_token
  → access_token (6hs), refresh_token (6 meses), user_id

URL de autorización:
https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id={id}&redirect_uri={uri}&state={state}

---

## BLOQUE 01 — SALUD

### Reputación del vendedor
GET /users/{seller_id}/seller_reputation
→ metrics.claims.rate           → % reclamos
→ metrics.delayed_handling_time.rate (invertido) → % envíos a tiempo
→ metrics.cancellations.rate    → % cancelaciones vendedor
→ transactions.ratings.negative → % mediaciones (proxy)
→ level_id                      → color de reputación
→ power_seller_status           → Platinum/Gold/Silver/null

### Info básica del usuario
GET /users/{user_id}
→ seller_reputation.transactions.completed
→ seller_reputation.level_id

---

## BLOQUE 02 — PUBLICACIONES

### Total de publicaciones
GET /users/{seller_id}/items/search?status=active&limit=1
→ paging.total → cantidad activas

GET /users/{seller_id}/items/search?limit=1
→ paging.total → total catálogo

GET /users/{seller_id}/items/search?status=paused&limit=1
→ paging.total → pausadas

### Items con logística Full
GET /users/{seller_id}/items/search?logistic_type=fulfillment&limit=1
→ paging.total → items en Full/Flex

### Performance/calidad de una publicación
GET /item/{item_id}/performance
→ score (0-100) → nivel de optimización
→ level_wording → "Platinum" | "Profesional" | etc.
→ buckets → bloques de mejora (CHARACTERISTICS, PICTURES, etc.)
⚠️ NOTA: /health está deprecado → usar /performance

### Buscar items por SKU
GET /users/{seller_id}/items/search?seller_sku={sku}
→ results → array de item_ids

### Items con exposición baja por reclamos/cancelaciones
GET /users/{seller_id}/items/search?labels=with_low_exposure
→ detecta publicaciones penalizadas

### CTR — NO DISPONIBLE EN API OFICIAL
→ Requiere scraper o carga manual desde ML Ads panel

---

## BLOQUE 03 — ADS (MERCADO ADS / PRODUCT ADS)

### Obtener advertiser_id del vendedor
GET /advertising/advertisers?product_id=PADS
Authorization: Bearer {token}
Api-Version: 1
→ advertiser_id → usar en el resto de endpoints de ads

### Métricas de campaña (Product Ads)
GET /advertising/advertisers/{advertiser_id}/product_ads/reports
  ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
  &metrics=spend,advertised_sales,total_amount,units_quantity,roas,cvr
→ spend                   → gasto total en ads ($)
→ advertised_sales        → ventas atribuidas a ads ($)
→ total_amount            → ventas totales ($)
→ roas                    → ROAS directo
→ units_quantity          → unidades vendidas por ads
→ advertising_items_quantity → ventas por publicidad
⚠️ NOTA: ACOS y TACOS se calculan en la app, no vienen directos

### Campañas activas
GET /advertising/advertisers/{advertiser_id}/ads/campaigns
→ estado de cada campaña
→ presupuesto asignado vs ejecutado

### Métricas individuales por ítem en ads
GET /advertising/product_ads/items/{item_id}
Api-Version: 2
→ métricas de performance de ese ítem en ads

---

## BLOQUE 04 — LOGÍSTICA

### Órdenes del vendedor (últimos 30/60 días)
GET /orders/search?seller={seller_id}&order.date_created.from={date}&order.status=paid
→ Array de órdenes con:
  → shipping.status / shipping.substatus → incidencias
  → status (cancelled) + cancel_detail.description → cancelaciones por stock
  → Calcular: % incidencias = órdenes con problema / total

### Órdenes canceladas
GET /orders/search?seller={seller_id}&order.status=cancelled
→ cancel_detail.description → filtrar "out_of_stock"
→ % cancelaciones stock = canceladas_por_stock / total_ordenes

### Items con logística Full/Flex
GET /users/{seller_id}/items/search?logistic_type=fulfillment&limit=1
→ % Full/Flex = fullItems.total / allItems.total * 100

### Estado de envío de una orden
GET /shipments/{shipping_id}
→ status → shipped/delivered/cancelled
→ substatus → bad_address, damaged, etc.

---

## BLOQUE 05 — STOCK

### Stock de un item específico
GET /items/{item_id}
→ available_quantity → stock disponible
→ inventory_id → ID para consultar stock en fulfillment

### Stock en depósitos Full (Fulfillment)
# Primero obtener inventory_id:
GET /items/{item_id}
→ inventory_id

# Luego consultar stock:
GET /stock/fulfillment/operations/search
  ?seller_id={seller_id}&inventory_id={inventory_id}
→ available_quantity → stock disponible en depósito Full
→ Operaciones: inbound_reception, sale_confirmation, etc.

### Total de items sin stock
# Calcular en la app:
# → traer todos los items activos
# → filtrar available_quantity === 0
# → % sin stock = sinStock / total * 100

⚠️ CAMPOS NO DISPONIBLES EN API (siempre manuales):
→ dias_stock (dato interno del cliente)
→ lead_time_reposicion (dato del proveedor del cliente)

---

## NOTIFICACIONES Y WEBHOOKS

### Topics disponibles para suscribirse:
- orders_v2              → nuevas órdenes, cambios de estado
- items                  → cambios en publicaciones
- questions              → preguntas recibidas
- payments               → pagos
- shipments              → cambios en envíos
- fbm_stock_operations   → cambios de stock en Full
- items_prices           → cambios de precio
- messages               → mensajes post-venta

### Configurar webhook:
POST /applications/{app_id}/webhooks
→ url, topics[]

---

## MÉTRICAS ADICIONALES ÚTILES

### Preguntas sin responder
GET /questions/search?seller_id={seller_id}&status=unanswered
→ total → cantidad de preguntas pendientes

### Reclamos activos
GET /claims/search?seller_id={seller_id}&status=opened
→ total → reclamos abiertos
→ type → reclamation, cancel, etc.

### Ventas por período (billing)
GET /billing/integration/periods/{period_id}/documents
→ comisiones reales, costos de envío, retenciones

### Tendencias de búsqueda
GET /trends/MLA/{category_id}
→ keywords → términos trending en la categoría del vendedor
→ Útil para Dai y Joaquín para detectar oportunidades

---

## RATE LIMITS

- Apps no certificadas: 3.000 req/día
- Apps certificadas ML: 30.000 req/día
- Rate limit por minuto: ~50-100 req/min
- Error 429 → Retry-After header indica cuántos segundos esperar
- Estrategia recomendada: sync diario por cuenta en ventana nocturna

---

## CONSIDERACIONES IMPORTANTES

1. El token expira cada 6 horas → implementar refresh automático
2. El callback OAuth recibe el code y state → validar state contra client_id (anti-CSRF)
3. Retiro en sucursal DEPRECADO desde Junio 2026 → solo Full, Flex, envío tradicional
4. /health de publicaciones DEPRECADO → usar /item/{id}/performance
5. ACOS/ROAS/TACOS → calcular en la app, no vienen directos de la API
6. Los tokens se guardan en Supabase Storage, nunca en columnas de DB
7. Para MLA (Argentina): site_id = "MLA"
