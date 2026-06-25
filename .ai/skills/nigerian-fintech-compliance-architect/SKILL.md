---
name: nigerian-fintech-compliance-architect
description: >
  Implements Nigerian regulatory compliance for fintech products: FIRS e-invoicing integration
  (Phase 1-3), VAT/CIT/WHT computation across 22 rate codes, NRS 2026 VAIDS compliance,
  BVN/NIN identity validation, NIBSS payment gateway patterns, NDPR data handling, and
  Lagos Pidgin as a first-class i18n locale. Use this skill for TaxBridge features, FIRS API
  integration, Nigerian tax computation, receipt OCR processing, CAC number validation, or
  any product that must comply with Nigerian fiscal and identity regulations. Triggers:
  "FIRS", "TaxBridge", "VAT Nigeria", "CIT", "WHT", "e-invoicing", "NRS 2026", "VAIDS",
  "BVN validation", "NIN", "NIBSS", "CAC number", "Lagos Pidgin", "Nigerian tax",
  "FIRS submission", "input VAT credit". Always use this skill for TaxBridge features —
  Nigerian tax rules are specific, change with each Finance Act, and have no safe defaults.
---

# Nigerian Fintech Compliance Architect

Nigerian tax and identity compliance is not a wrapper around generic fintech patterns.
Every rule is jurisdiction-specific, Finance Act–versioned, and enforced via FIRS systems.
Model it as a first-class domain.

## Regulatory Reference Frame (as of Finance Act 2023 / NRS 2026)

| Tax Type | Rate | Basis | Remittance deadline |
|---|---|---|---|
| VAT (standard) | 7.5% | Taxable supplies | 21st of following month |
| VAT (zero-rated) | 0% | Exports, basic food, books | 21st of following month |
| CIT (large companies) | 30% | Net profit above ₦25M | 6 months after year-end |
| CIT (medium companies) | 20% | Net profit ₦25M–₦100M | 6 months after year-end |
| CIT (small companies) | 0% | Turnover < ₦25M | Exempt |
| WHT (rent) | 10% | Rent payments | 21st of following month |
| WHT (professional fees) | 5% / 10% | Professional services | 21st of following month |
| WHT (dividends) | 10% | Dividend distribution | 21st of following month |
| Development Levy | ₦1,000 flat | Per employee per annum | March 31 |

---

## Step 1 — Tax Computation Kernel

```typescript
// lib/tax/computation.ts
// Core computation engine — no IO, pure functions, fully testable

export type VATRateCode = 'standard' | 'zero-rated' | 'exempt'
export type WHTCategory =
  | 'rent'
  | 'professional-fees-resident'
  | 'professional-fees-non-resident'
  | 'dividends'
  | 'royalties'
  | 'contracts-above-threshold'

export const WHT_RATES: Record<WHTCategory, number> = {
  'rent':                          0.10,
  'professional-fees-resident':    0.05,
  'professional-fees-non-resident': 0.10,
  'dividends':                     0.10,
  'royalties':                     0.10,
  'contracts-above-threshold':     0.05,
}

export function computeVAT(params: {
  grossAmount: number
  rateCode:    VATRateCode
}): VATResult {
  const { grossAmount, rateCode } = params

  if (rateCode === 'exempt') {
    return { vatAmount: 0, netAmount: grossAmount, rateCode, ratePercentage: 0 }
  }

  const ratePercentage = rateCode === 'zero-rated' ? 0 : 7.5
  const vatAmount = grossAmount * (ratePercentage / 100)

  return {
    vatAmount:       round2(vatAmount),
    netAmount:       round2(grossAmount),
    grossWithVAT:    round2(grossAmount + vatAmount),
    rateCode,
    ratePercentage,
  }
}

export function computeWHT(params: {
  grossAmount: number
  category:    WHTCategory
}): WHTResult {
  const rate = WHT_RATES[params.category]
  const whtAmount = round2(params.grossAmount * rate)
  return {
    whtAmount,
    netPayable: round2(params.grossAmount - whtAmount),  // payer remits WHT, payee gets net
    category:   params.category,
    ratePercent: rate * 100,
  }
}

export function computeVATReturn(params: {
  outputVAT:   number  // VAT charged on sales
  inputVAT:    number  // VAT paid on purchases (claimable credit)
  adjustments: number  // corrections from prior periods
}): VATReturnResult {
  const netVAT = params.outputVAT - params.inputVAT + params.adjustments

  return {
    outputVAT:       round2(params.outputVAT),
    inputVAT:        round2(params.inputVAT),
    netVATPayable:   round2(Math.max(0, netVAT)),
    inputVATExcess:  round2(Math.max(0, -netVAT)),  // excess input credit — carry forward
    adjustments:     round2(params.adjustments),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

---

## Step 2 — FIRS e-Invoice Integration (Phase 1)

```typescript
// lib/firs/e-invoice.ts
// FIRS TaxPro-Max e-invoicing — Phase 1 (IRN generation)

export interface FIRSInvoice {
  invoiceRef:    string       // your internal reference — immutable after creation
  tin:           string       // 11-digit TIN
  businessName:  string
  invoiceDate:   string       // YYYY-MM-DD
  lineItems:     InvoiceLineItem[]
  vatSummary:    VATSummary
  paymentTerms:  string
}

export interface FIRSIRNResponse {
  irn:           string       // Invoice Reference Number — from FIRS
  qrCode:        string       // base64 QR code for printable invoice
  status:        'accepted' | 'rejected' | 'pending'
  validatedAt:   string
  rejectionReason?: string
}

export class FIRSApiService extends Effect.Service<FIRSApiService>()('FIRSApiService', {
  effect: Effect.gen(function* () {
    const http    = yield* HttpClient
    const config  = yield* FIRSConfig

    return {
      submitInvoice: (
        invoice: FIRSInvoice
      ): Effect.Effect<FIRSIRNResponse, FIRSApiError> =>
        pipe(
          // FIRS requires HMAC-SHA256 signature on the payload
          signInvoicePayload(invoice, config.apiSecret),
          Effect.flatMap(signed =>
            http.post(`${config.baseUrl}/api/v1/invoice/submit`, {
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type':  'application/json',
                'X-TIN':         invoice.tin,
              },
              body: JSON.stringify(signed),
            })
          ),
          Effect.flatMap(res => parseResponse<FIRSIRNResponse>(res)),
          // FIRS API is often slow — retry with exponential backoff
          Effect.retry(Schedule.exponential(Duration.seconds(2)).pipe(
            Schedule.intersect(Schedule.recurs(3))
          )),
          Effect.mapError(mapFIRSError),
        ),

      // Always store the FIRS audit trail — required for 6-year retention
      getInvoiceStatus: (irn: string) =>
        http.get(`${config.baseUrl}/api/v1/invoice/${irn}/status`, {
          headers: { 'Authorization': `Bearer ${config.apiKey}` },
        }).then(res => parseResponse<FIRSIRNResponse>(res)),
    }
  }),
}) {}
```

---

## Step 3 — Identity Validation (BVN / NIN / TIN / CAC)

```typescript
// lib/identity/validators.ts

// TIN: 11 digits, FIRS-issued
export const TIN_REGEX = /^\d{11}$/
export function validateTIN(tin: string): ValidationResult {
  if (!TIN_REGEX.test(tin.replace(/\s/g, ''))) {
    return { valid: false, error: 'TIN must be exactly 11 digits (e.g. 12345678901)' }
  }
  return { valid: true }
}

// BVN: 11 digits, CBN-issued
export const BVN_REGEX = /^\d{11}$/
export function validateBVN(bvn: string): ValidationResult {
  if (!BVN_REGEX.test(bvn)) {
    return { valid: false, error: 'BVN must be exactly 11 digits' }
  }
  return { valid: true }
}

// NIN: 11 digits, NIMC-issued
export const NIN_REGEX = /^\d{11}$/

// CAC Registration: RC followed by digits (e.g. RC123456) or BN for business names
export const CAC_REGEX = /^(RC|BN|IT)\d{5,7}$/i
export function validateCAC(cac: string): ValidationResult {
  const normalized = cac.replace(/\s/g, '').toUpperCase()
  if (!CAC_REGEX.test(normalized)) {
    return {
      valid:   false,
      error:   'CAC number must start with RC, BN, or IT followed by 5–7 digits (e.g. RC123456)',
    }
  }
  return { valid: true, normalized }
}

// Nigerian phone: +234 or 0 prefix, 10 digits after prefix
export const NGN_PHONE_REGEX = /^(\+234|0)[789]\d{9}$/
export function validateNigerianPhone(phone: string): ValidationResult {
  const normalized = phone.replace(/\s|-/g, '')
  if (!NGN_PHONE_REGEX.test(normalized)) {
    return { valid: false, error: 'Enter a valid Nigerian phone number (e.g. 08012345678)' }
  }
  return { valid: true, normalized }
}
```

---

## Step 4 — Currency and Number Formatting

```typescript
// lib/i18n/currency.ts
// Naira formatting — always explicit, never ambiguous

export function formatNaira(
  amount: number,
  options: { showKobo?: boolean; compact?: boolean } = {}
): string {
  const { showKobo = true, compact = false } = options

  if (compact && amount >= 1_000_000) {
    return `₦${(amount / 1_000_000).toFixed(1)}M`
  }
  if (compact && amount >= 1_000) {
    return `₦${(amount / 1_000).toFixed(1)}K`
  }

  return new Intl.NumberFormat('en-NG', {
    style:                 'currency',
    currency:              'NGN',
    minimumFractionDigits: showKobo ? 2 : 0,
    maximumFractionDigits: showKobo ? 2 : 0,
  }).format(amount)
  // Output: ₦1,234,567.89
}

// Tax period formatting
export function formatTaxPeriod(year: number, month: number): string {
  const monthName = new Date(year, month - 1).toLocaleDateString('en-NG', { month: 'long' })
  return `${monthName} ${year}`  // "January 2026"
}
```

---

## Step 5 — Lagos Pidgin (pcm) i18n

Lagos Pidgin is not a dialect — it is a first-class locale for Nigerian SME users.

```typescript
// lib/i18n/messages.ts
// English and Lagos Pidgin are co-equal locales

export const messages = {
  en: {
    'vat.return.title':       'VAT Return',
    'vat.return.submit':      'Submit Return',
    'vat.return.filed':       'Return filed successfully',
    'error.tin.invalid':      'TIN must be 11 digits',
    'error.firs.timeout':     'FIRS system is temporarily unavailable. Please try again.',
    'dashboard.welcome':      'Welcome back, {name}',
    'receipt.scan.prompt':    'Take a photo of your receipt',
  },
  pcm: {
    'vat.return.title':       'VAT Return',
    'vat.return.submit':      'Submit di Return',
    'vat.return.filed':       'E don submit finish',
    'error.tin.invalid':      'TIN must be 11 number, abeg check am again',
    'error.firs.timeout':     'FIRS system no dey work now. Try again later.',
    'dashboard.welcome':      'Welcome back, {name}',
    'receipt.scan.prompt':    'Take picture of your receipt',
  },
}

// Type-safe translation hook
export function useTranslation(locale: 'en' | 'pcm') {
  return {
    t: (key: keyof typeof messages['en'], params?: Record<string, string>) => {
      const template = messages[locale][key] ?? messages['en'][key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, v),
        template
      )
    },
  }
}
```

---

## Step 6 — NDPR Data Handling (Nigerian Data Protection Regulation)

```typescript
// lib/ndpr/pii.ts
// NDPR requires explicit consent and minimization for PII

// PII fields that require masking in logs and responses
export const PII_FIELDS = ['bvn', 'nin', 'tin', 'phone', 'email', 'address'] as const

export function maskPII<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if ((PII_FIELDS as readonly string[]).includes(key.toLowerCase()) && typeof value === 'string') {
        return [key, `${value.slice(0, 3)}****${value.slice(-2)}`]
      }
      return [key, value]
    })
  ) as T
}

// Structured logger — never log raw PII
export function logBusinessEvent(event: string, data: Record<string, unknown>) {
  logger.info(event, maskPII(data))
}
```

---

## Quality Gates

- [ ] All tax computations use the kernel functions — no inline rate arithmetic
- [ ] FIRS API calls have idempotency keys (invoiceRef as the deduplication key)
- [ ] FIRS submissions have a 6-year audit trail (FIRS retention requirement)
- [ ] BVN and NIN are never logged in plaintext — always masked
- [ ] Currency is always formatted as ₦ (Naira), never "NGN" in user-facing UI
- [ ] Both `en` and `pcm` locale strings exist for every user-facing message
- [ ] FIRS API rate limits are handled with retry + exponential backoff
- [ ] TIN validation rejects empty strings, non-numeric, and wrong-length inputs

---

## Pair This Skill With

- `backend-domain-model-architect` — model TaxComputation as a bounded context
- `security-hardening-auditor` — PII handling, NDPR consent flows
- `backend-systems-auditor` — FIRS API idempotency and audit trail
- `api-contract-governance-architect` — FIRS webhook contracts, e-invoice schema
- `opentelemetry-observability-architect` — FIRS API call latency and error tracking
- `react-native-expo-architect` — TaxBridge mobile receipt scanner (Expo + ML Kit)

---

## Activation Triggers

- "TaxBridge", "FIRS integration", "e-invoicing Nigeria"
- "VAT computation / WHT computation / CIT computation"
- "NRS 2026 compliance", "VAIDS"
- "BVN validation", "NIN validation", "TIN validation", "CAC number"
- "Nigerian tax filing", "FIRS submission"
- "Lagos Pidgin i18n", "pcm locale"
- "NDPR compliance", "Nigerian data protection"
- "NIBSS payment gateway"
- "Naira formatting", "₦ currency display"
- "Input VAT credit", "VAT return Nigeria"
- "Finance Act 2023 rate codes"
- "Receipt scanner for Nigerian SME"
