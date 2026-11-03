# Elorus Fuse (demo)

Issues Greek fiscal documents (retail receipt `11.2`, service invoice `2.1`) via Elorus Fuse and stores MARK/UID locally.

## Smoke path (staging)

1. Create password for the Fuse demo portal email, then create an API token:  
   https://help.elorusfuse.gr/rithmiseis-xristi/#api-keys
2. Set env on the API:

```bash
ELORUS_FUSE_BASE_URL=https://api.fuse-staging.gr
ELORUS_FUSE_API_TOKEN=<token>
```

3. Run migrations so `fiscal_documents` / school AFM fields exist.
4. In Admin → Οικονομικά → Ρυθμίσεις, set school AFM (demo org VAT) and series (e.g. `ΑΠ`, `ΤΙΜ`).
5. Open a student → Οικονομικά → **Έκδοση παραστατικού**:
   - Απόδειξη (no counterparty AFM)
   - Τιμολόγιο (requires counterparty AFM + name)
6. Confirm the document appears in the Fuse demo portal / myDATA demo. Use **Ανανέωση** if MARK is still pending (`mydata_status` may be queued after HTTP 201).

## Endpoints

- `GET/PATCH /schools/:schoolId/fiscal-settings`
- `GET/POST /schools/:schoolId/fiscal-documents`
- `POST /schools/:schoolId/fiscal-documents/:id/refresh`

Payment recording and the internal «Απόδειξη Είσπραξης» PDF are unchanged; fiscal issue is a separate admin action.
