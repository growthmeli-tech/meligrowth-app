# Security — operations (DPP / MercadoLibre)

## Outbound IP allowlisting (production)

MercadoLibre recommends limiting which IP addresses use your application’s access tokens to your production environment. This is an **operational** DPP (Developer Partner Program) practice: it is **not** implemented in application code.

### Vercel static outbound IPs

1. In the [Vercel dashboard](https://vercel.com), open your project → **Settings** → **Network** (or the plan’s documentation for static IPs, depending on your Vercel plan and region).
2. Note the **static outbound IP addresses** assigned to your project (or purchase the add-on that provides fixed egress IPs if your plan does not include them by default).
3. In [Mercado Libre Developers / DevCenter](https://developers.mercadolibre.com.ar/), open your application and find the section for **IP restrictions** or **security** (wording may vary by site) where allowed caller IPs are configured.
4. Add only those production egress IPs. Do not add development machines or ad-hoc IPs unless required for a short, documented exception.

### Why this lives in ops docs

- The app cannot know Vercel’s outbound IP at build time in all setups; the team must **configure** the allowlist in ML when static egress is available.
- Rotations or plan changes on Vercel can change IPs — re-check when infrastructure changes.

### Related in-repo rules

- All HTTP calls to MercadoLibre APIs go through `lib/ml/client.ts` (single token transport and policy surface).
- Tokens are stored in Supabase Storage (`meli-sessions`), not in plain columns in the database (see `lib/ml/auth.ts` and product docs).
