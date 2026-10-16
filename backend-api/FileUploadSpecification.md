# ShweMal File Upload Specification

## 1. Document Information
- **Project Name**: ShweMal
- **Document Type**: File Upload Technical / Functional Specification
- **Platform**: Web Application (Vite + React frontend, Express + Prisma backend)
- **Version**: 1.0
- **Date**: 2026-08-12
- **Related Document**: `ShweMal_Requirement_Specification.md`
- **Prepared For**: Product, Design, Development, QA, and Operations Teams

---

## 2. Purpose and Overview

This document specifies how ShweMal will handle photo and document uploads for the next implementation increment.

### 2.1 Current state (before this increment)
- Forms collect **path strings** only (placeholders such as `uploads/nrc-front.jpg`).
- Domain APIs persist those strings in PostgreSQL via Prisma.
- There is **no** multipart upload endpoint, disk write, static file serving for uploads, or real file-picker UI.
- Binary upload was intentionally deferred in Increments A–D.

### 2.2 Goal of this increment
Enable real file selection, local server storage, path persistence, and image display **without cloud storage**.

### 2.3 Out of scope
- Cloud object storage (S3, GCS, Azure Blob, R2, etc.)
- Storing binary files in PostgreSQL BLOBs
- Base64 embedding of images inside JSON create/update payloads
- Image cropping / editing tools
- HEIC conversion (document jpg/png/webp only for v1)
- Automatic orphan-file cleanup / TTL jobs (may be added later)
- PDF/Excel report export and unrelated admin queue work

---

## 3. Design Principles

1. **Upload-first, then save entity** — clients upload binaries to a shared upload API, receive path strings, then submit existing JSON domain APIs unchanged (except stricter path format).
2. **Local disk only** — files are stored under `backend-api/uploads/`.
3. **One shared pipeline** — houses, moving, profile, and docs all use the same upload endpoint with a `category` parameter.
4. **Keep existing DB columns** — continue using `imagePath`, `photoPath`, `*PhotoPath`, `profilePicturePath`, and `imagePaths` / `photos` arrays as string paths.
5. **Cloud-ready later** — storage is an adapter behind the upload API; DB still stores a path or object key.

---

## 4. Storage Model

### 4.1 Root and folders
| Item | Value |
|------|--------|
| Upload root | `UPLOAD_ROOT` env (default: `backend-api/uploads`) |
| House images | `uploads/houses/` |
| Moving cargo photos | `uploads/moving/` |
| Sensitive docs (NRC, license, etc.) | `uploads/docs/` |
| Profile pictures | `uploads/profile/` |

### 4.2 Filename rules
- Never trust the client filename.
- Store as `{uuid}{normalizedExtension}` (example: `uploads/houses/a1b2c3d4-....jpg`).
- Relative path stored in DB must match:

```text
^uploads/(houses|moving|docs|profile)/[a-zA-Z0-9._-]+$
```

- Reject path traversal (`..`), absolute paths, and arbitrary external URLs in domain validators.

### 4.3 Git / deployment
- Ignore uploaded binaries in git (`uploads/**` except `.gitkeep`).
- Treat `uploads/` as application data; include in server backup.
- Ensure upload directories are created on application boot if missing.

---

## 5. Categories and Access Control

| Category | Typical content | Serving | Who can upload | Who can view |
|----------|-----------------|---------|----------------|--------------|
| `houses` | Listing photos (1–5) | Public static | Authenticated verified agent (or as enforced by house APIs) | Anyone (public portal) |
| `moving` | Pre-move cargo photos (1–5) | Public static | Authenticated user creating moving request | Request owner, assigned driver, admin |
| `profile` | User profile picture | Public static | Authenticated user (own profile) | Authenticated users / public as already shown in UI |
| `docs` | NRC front/back, driving license, wheel tax, and other sensitive docs | **Not** public static; auth-gated file route | Authenticated registrant (agent/driver) | Owner and admin only |

### 5.1 Public serving
- Mount static serving for public categories only, or block `/uploads/docs/**` from static access.
- Suggested URL shape: `{API_ORIGIN}/uploads/houses/{file}` (and same for `moving`, `profile`).

### 5.2 Protected docs serving
- `GET /api/v1/files/*` (or equivalent) streams a file after JWT validation and ownership/admin checks.
- Direct URL guessing of `uploads/docs/...` must not succeed via public static hosting.

---

## 6. Validation Rules

Aligned with NFR item 6 in the main SRS (file type and size validation).

| Rule | Value |
|------|--------|
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Allowed extensions | `.jpg`, `.jpeg`, `.png`, `.webp` |
| Max file size | 5 MB per file (`UPLOAD_MAX_BYTES`) |
| Max files per upload request | 1–5 for `houses` and `moving`; **1** for single-field `docs` / typical profile field |
| Auth | Required for all upload requests |
| Empty file | Rejected |
| Content sniffing (optional hardening) | Prefer magic-byte check in a later hardening pass |

### 6.1 Client-side validation
- Enforce type, size, and count before upload for fast UX feedback.
- Server-side validation remains authoritative.

### 6.2 Server error responses (suggested)
| Condition | HTTP | Message intent |
|-----------|------|----------------|
| Unauthenticated | 401 | Sign in required |
| Forbidden category/role | 403 | Not allowed |
| Too many files | 400 | Max files exceeded |
| File too large | 400 / 413 | File exceeds size limit |
| Unsupported type | 400 | Only jpeg/png/webp allowed |
| Missing file | 400 | No file provided |

---

## 7. API Specification

### 7.1 Upload binaries
- **Method / path**: `POST /api/v1/uploads`
- **Auth**: Bearer JWT required
- **Query or body field**: `category` = `houses` \| `moving` \| `docs` \| `profile`
- **Content-Type**: `multipart/form-data`
- **Field name**: `files` (one or more)

**Success response (200/201):**
```json
{
  "paths": [
    "uploads/houses/11111111-2222-3333-4444-555555555555.jpg",
    "uploads/houses/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png"
  ]
}
```

### 7.2 Existing domain APIs (unchanged contract, stricter paths)
Domain create/update endpoints continue to accept path strings:

| Domain | Endpoints (existing) | Path fields |
|--------|----------------------|-------------|
| Agent houses | `POST/PATCH /api/v1/agent/houses` | `imagePaths[]` (1–5) |
| Moving | `POST /api/v1/moving/requests` | `photos[]` (1–5) |
| Agent registration | `POST /api/v1/registrations/agent` | `nrcFrontPhotoPath`, `nrcBackPhotoPath` |
| Driver registration | `POST /api/v1/registrations/driver` | `nrcFrontPhotoPath`, `nrcBackPhotoPath`, `drivingLicensePhotoPath`, `profilePhotoPath`, `vehiclePhotoPath`, `wheelTaxPhotoPath` |
| Profile | `PATCH /api/v1/profile` (or equivalent) | `profilePicturePath` |

**Flow:**
1. Client uploads file(s) → receives `paths`.
2. Client puts paths into form state.
3. Client submits JSON domain request as today.

### 7.3 Protected file download
- **Method / path**: `GET /api/v1/files/:category/:filename` (docs only, or general with ACL)
- **Auth**: Required
- **ACL**: Owner of related registration/entity, or admin
- **Response**: Binary stream with correct `Content-Type`

---

## 8. Backend Implementation Notes

### 8.1 Suggested stack additions
- `multer` for multipart parsing
- Express static for public categories
- Env config: `UPLOAD_ROOT`, `UPLOAD_MAX_BYTES`, `UPLOAD_ALLOWED_MIME`

### 8.2 Module layout (suggested)
- `routes/v1/uploads.routes.ts` — upload route
- `routes/v1/files.routes.ts` — protected file streaming (if separate)
- `middleware/upload.middleware.ts` — multer + validation
- `services/upload.service.ts` — save, path normalize, optional delete helpers
- Boot hook to ensure category directories exist

### 8.3 Security checklist
- Auth on upload
- Restrict MIME and size
- UUID filenames
- No static exposure of `docs`
- Path regex on domain validators
- Upload directory not executable / not serving scripts
- Optional: rate-limit `POST /uploads`

### 8.4 House edit behavior (v1 decision)
- On house PATCH, **replace-all** image paths provided by the client (simplest).
- Orphan previous files may remain on disk in v1 (cleanup later).

---

## 9. Frontend Implementation Notes

### 9.1 Shared components / helpers
- `uploadFiles(files, category)` — builds `FormData`, calls upload API, returns `paths`
- `ImageUploadField` — single file (docs, profile)
- `MultiImageUploadField` — 1–5 files with preview, remove, count limit
- Display URL helper: map stored relative path → `{API_ORIGIN}/{path}` for public categories; protected docs use authenticated fetch/blob URL or gated endpoint

### 9.2 UX requirements
- Native file picker (`type="file"`, `accept="image/jpeg,image/png,image/webp"`)
- Thumbnail preview after selection/upload
- Clear errors for type, size, and max count
- Remove deferred-upload i18n copy; use real labels and validation messages
- Do not require users to type path strings

### 9.3 Screens to wire (priority)

| Priority | Screen | Category | Requirement refs |
|----------|--------|----------|------------------|
| P0 | Agent house create/edit | `houses` | §8.3, FR-AGENT-003 |
| P1 | House cards / house details image render | — (display only) | FR-HOUSE-002 |
| P2 | Hire moving request form | `moving` | §8.4, FR-MOVE-001 |
| P3 | Profile picture update | `profile` | FR-PROFILE-001 |
| P4 | Agent register NRC photos | `docs` | §8.6, FR-AGENT-001 |
| P5 | Driver register document/vehicle photos | `docs` / `profile` as appropriate | §8.5, FR-DRIVER-001 |
| P6 | Driver jobs / admin viewing of photos | display + ACL | FR-DRIVER-005, NFR security |

---

## 10. Implementation Phases

### Phase 0 — Decisions (locked by this document)
- Upload-first shared API
- Local disk categories and limits above
- Public vs protected serving split
- No cloud in this version

### Phase 1 — Backend foundation
1. Config, folders, gitignore
2. Multer upload endpoint + tests
3. Public static serving (non-docs)
4. Path regex hardening on validators
5. Protected docs route + ACL tests

### Phase 2 — Shared frontend upload UX
1. Upload API client
2. Single/multi image field components
3. i18n updates
4. Component tests for validation

### Phase 3 — Screen wiring
1. Agent houses + public house display (vertical slice first)
2. Moving photos + display
3. Profile picture
4. Agent/driver docs with protected viewing

### Phase 4 — Security and operations
1. Confirm docs are not publicly listable
2. README setup notes for local uploads
3. Backup guidance for `uploads/`
4. Optional rate limiting

### Phase 5 — Documentation closeout
1. Update main SRS notes: binary upload no longer deferred for wired screens
2. Record cloud storage as future enhancement
3. Mark acceptance criteria for this specification

---

## 11. Requirements Traceability

| This spec | Main SRS / FR |
|-----------|----------------|
| House multi-image upload | §8.3 Upload House Images; FR-AGENT-003; FR-HOUSE-002 |
| Moving cargo photos | §8.4 Upload Pre-move cargo photos; FR-MOVE-001; FR-DRIVER-005 |
| Driver docs / vehicle photos | §8.5; FR-DRIVER-001 |
| Agent NRC photos | §8.6; FR-AGENT-001 |
| Profile picture | FR-PROFILE-001 |
| Type/size validation | NFR / Validation rule 6 |
| Protect sensitive uploads | NFR Security (~sensitive document uploads) |

---

## 12. Acceptance Criteria

This file-upload increment is accepted when:

1. Authenticated users can select real image files (not path text) on wired screens.
2. Files are stored on local disk under the correct category folder with UUID names.
3. Returned paths are persisted by existing domain APIs and satisfy the path regex.
4. House listing/detail pages show uploaded house images correctly.
5. Moving cargo photos upload and are visible to authorized roles.
6. Invalid MIME, oversize files, and excess file counts are rejected with clear errors.
7. NRC/license (docs) are not publicly accessible via static URL guessing.
8. Owner and admin can retrieve protected docs through the gated file API.
9. No cloud storage SDK or external object storage is required for this version.
10. Automated tests cover upload validation, public vs protected serving, and at least one domain create flow using uploaded paths.

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Frontend cannot load images because path is relative | Always resolve with API origin / configured static base URL |
| Users abandon form after upload (orphan files) | Accept in v1; optional cleanup job later |
| Phone HEIC photos fail | Document supported types; defer HEIC conversion |
| Docs accidentally exposed via static mount | Never statically serve `uploads/docs`; add tests |
| Path placeholder abuse continues | Enforce server path regex on all photo path fields |
| Disk growth on single server | Monitor disk; backup/retention policy; cloud migration later |

---

## 14. Future Enhancements (not this version)
1. Storage adapter for S3-compatible / cloud object storage with same upload API contract.
2. Signed URLs for temporary private access.
3. Server-side image resize/thumbnail generation.
4. HEIC/HEIF support and conversion.
5. Orphan file garbage collection.
6. Virus/malware scanning if required by policy.

---

## 15. Open Items
1. Exact ACL rules for viewing moving cargo photos beyond owner/driver/admin (confirm product preference).
2. Whether vehicle/wheel-tax photos are treated as `docs` (protected) or a public-ish category for admin convenience.
3. Whether profile pictures remain world-readable or auth-only.
4. Production reverse-proxy rules for `/uploads` vs API host.

---

## 16. Revision History
| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-08-12 | Initial local-disk upload specification (no cloud); upload-first shared API; phased implementation plan |
| 1.1 | 2026-08-13 | Implementation status: Phases 1–5 complete for wired screens; admin protected-doc preview; profile/roommate avatars |

---

## 17. Implementation Status (as of 2026-08-13)

| Area | Status |
|------|--------|
| Backend `POST /uploads` + static + protected docs | Done |
| Path regex on domain validators | Done |
| Agent house upload + house display | Done |
| Moving cargo upload + detail/driver display | Done |
| Profile picture upload + avatar display | Done |
| Agent/driver registration file pickers | Done |
| Admin verification queues + `GET /admin/agents|drivers/:userId` doc preview | Done |
| Cloud storage | Deferred |
