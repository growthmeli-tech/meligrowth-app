# Auditoría UX de Pantallas Existentes

## Criterios de evaluación Meli Growth
- Lo crítico debe verse primero.
- Acción principal visible sin scroll.
- Estado vacío siempre con CTA.
- Semáforo de score consistente.
- Tipografía y jerarquía alineadas a tokens.
- Lenguaje simple en vistas cliente.

## Resultado global
- Cumplimiento alto de estructura operativa base.
- Desvío principal: falta de jerarquía de urgencias en primer viewport.
- Brecha secundaria: sistema visual todavía usa paleta legacy (brand purple) y no tokens Meli Growth completos.

## Auditoría por ruta

### `/`
- Problemas:
  - Redirección fija a operator sin resolución por sesión/rol.
- Cambios recomendados:
  - Redirigir según rol autenticado (`operator` o `client`).
  - Si no hay sesión, llevar a login.
- Prioridad: media.

### `/login`
- Problemas:
  - Estética neutra, no comunica valor del producto ni próximos pasos.
- Cambios recomendados:
  - Incorporar mensaje breve por rol.
  - Ajustar fondo/tokens al sistema visual Meli Growth.
- Prioridad: baja.

### `/operator/dashboard`
- Problemas:
  - No existe `AlertBanner` prioritario en top de pantalla.
  - KPIs de resumen compiten con urgencias reales.
  - Estados críticos dependen de filtros/manual scan.
- Cambios recomendados:
  - Insertar `AlertBanner` nivel 1/2 arriba del resumen.
  - Crear bloque fijo "Clientes en riesgo" con top 3.
  - Mantener CTA principal (`Nuevo cliente`) siempre visible.
- Prioridad: crítica.

### `/operator/clients/new`
- Problemas:
  - Flujo correcto, pero foco principal repartido entre demasiados campos iniciales.
- Cambios recomendados:
  - Separar "datos mínimos para alta" de "datos opcionales".
  - Incluir indicador de progreso del onboarding.
- Prioridad: media.

### `/operator/clients/[id]`
- Problemas:
  - Recomendaciones no están estructuradas como panel dedicado priorizado.
  - El tab model puede ocultar información urgente en ciertos contextos.
  - Falta `ScoreDisplay` con delta dominante en encabezado.
- Cambios recomendados:
  - Incorporar módulo fijo de recomendaciones sobre tabs.
  - Crear `BlockScoreRow` compacto bajo score global.
  - Elevar visualmente score + delta como primer bloque.
- Prioridad: crítica.

### `/operator/clients/[id]/diagnostic/new`
- Problemas:
  - Falta benchmark inline explícito por campo.
  - Falta badge de fuente de dato (`ML API`, `Scraper`, `Manual`).
  - Post-submit no está diseñado como pantalla de resultado con recomendaciones.
- Cambios recomendados:
  - Implementar `DiagnosticFieldWithBenchmark`.
  - Mostrar score y semáforo en tiempo real por bloque.
  - Incorporar post-submit con recomendaciones generadas.
- Prioridad: crítica.

### `/operator/clients/[id]/files`
- Problemas:
  - Densidad alta de información técnica para flujo operativo rápido.
  - Prioridad visual no destaca archivos faltantes críticos.
- Cambios recomendados:
  - Resumen superior "completitud de planillas" con semáforo.
  - CTA destacado para archivo faltante de mayor impacto.
- Prioridad: media.

### `/operator/clients/[id]/settings`
- Problemas:
  - Mezcla de configuración general, sesión ML y scraping en una sola superficie extensa.
  - Acciones sensibles no están segmentadas por riesgo.
- Cambios recomendados:
  - Dividir en secciones por criticidad (cuenta, acceso, datos ML, scraping).
  - Reforzar confirmaciones para acciones de impacto.
- Prioridad: media.

### `/operator/pricing`
- Problemas:
  - Buena cobertura funcional, pero carga cognitiva elevada.
  - Acción primaria de guardado compite con múltiples bloques auxiliares.
- Cambios recomendados:
  - Definir flujo guiado por pasos: importar -> calcular -> guardar.
  - Fijar CTA principal contextual por etapa.
- Prioridad: media.

### `/operator/notifications`
- Problemas:
  - Falta jerarquía visual estricta por nivel de alerta.
  - No hay separación clara entre crítico/urgente/importante.
- Cambios recomendados:
  - Agrupar por severidad y recencia.
  - Integrar chips de nivel y CTA de resolución rápida.
- Prioridad: alta.

### `/client/dashboard`
- Problemas:
  - Parte del contenido todavía se apoya en conceptos técnicos.
  - Falta checklist explícito de próximos pasos del cliente.
- Cambios recomendados:
  - Traducir todo estado a lenguaje humano.
  - Mostrar progreso con mensajes de negocio y CTA claros.
- Prioridad: alta.

### `/client/metrics`
- Problemas:
  - Vista orientada a score técnico sin suficiente traducción narrativa.
  - El estado por área usa terminología interna en partes.
- Cambios recomendados:
  - Añadir interpretación textual de tendencia.
  - Mostrar solo datos accionables para cliente final.
- Prioridad: media.

### `/client/files`
- Problemas:
  - Flujo útil, pero falta jerarquía de "archivo más urgente".
  - No se muestra impacto de cada archivo en resultado de cuenta.
- Cambios recomendados:
  - Ordenar plantillas por impacto en score.
  - Agregar microcopy de valor por archivo.
- Prioridad: media.

### `/client/notifications`
- Problemas:
  - Riesgo de lenguaje interno heredado desde backend/eventos.
- Cambios recomendados:
  - Forzar diccionario de textos "cliente-friendly".
  - Mantener severidad visual sin tecnicismos.
- Prioridad: alta.

### `/error`
- Problemas:
  - Mensaje correcto, pero no diferencia contexto operator/client.
- Cambios recomendados:
  - Ajustar copy según rol.
  - Ofrecer CTA alternativo: ir al dashboard correspondiente.
- Prioridad: baja.

### `/not-found`
- Problemas:
  - Redirección sugerida solo a operator.
- Cambios recomendados:
  - Resolver destino según rol de sesión.
- Prioridad: baja.

## Priorización de ejecución (recomendada)
1. Crítica: `/operator/dashboard`, `/operator/clients/[id]`, `/operator/clients/[id]/diagnostic/new`.
2. Alta: `/operator/notifications`, `/client/dashboard`, `/client/notifications`.
3. Media: onboarding/settings/files/pricing/metrics.
4. Baja: login/error/not-found.

## Riesgos si no se corrige
- Alertas críticas pueden pasar desapercibidas en operación diaria.
- Baja conversión de recomendaciones a acciones.
- Cliente final con menor comprensión de valor mensual.
