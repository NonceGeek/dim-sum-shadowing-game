# Dim Sum Shadowing Game API

Cantonese shadowing backend (Deno + Oak). Default local base URL:

```
http://localhost:3003
```

Production example:

```
https://api.shadowing.app.aidimsum.com
```

All JSON responses use `Content-Type: application/json`. CORS is enabled on all routes.

Browse this file in the browser:

- Markdown: [`GET /docs`](#get-docs)
- HTML (GFM styled): [`GET /docs/html`](#get-docshtml)

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` | For transcription | OpenRouter API key |
| `OPENROUTER_TRANSCRIPTION_MODEL` | No | Default: `qwen/qwen3-asr-flash-2026-02-10` |
| `OPENROUTER_HTTP_REFERER` | No | Optional OpenRouter `HTTP-Referer` header |
| `OPENROUTER_SITE_TITLE` | No | Optional OpenRouter `X-OpenRouter-Title` header |
| `SUPABASE_URL` | For `/api/libs` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | For `/api/libs` | Supabase service-role key |
| `LIB_CREATE_PASSWD` | For `POST /api/libs` | Create password |
| `LIB_UPDATE_PASSWD` | For `PATCH /api/libs/:id` | Update password |
| `LIB_DELETE_PASSWD` | For `DELETE /api/libs/:id` | Delete password |
| `PORT` | No | Default: `3003` |

---

## General

### `GET /`

Health greeting.

```bash
curl http://localhost:3003/
```

**Response** `200`

```
Dim Sum Shadowing Game API
```

---

### `GET /health`

Health check.

```bash
curl http://localhost:3003/health
```

**Response** `200`

```json
{
  "status": "healthy",
  "timestamp": "2026-06-02T12:00:00.000Z"
}
```

---

## Documentation

### `GET /docs`

Return this API reference as raw Markdown (`api_doc.md`).

```bash
curl http://localhost:3003/docs
```

**Response** `200`

- **Content-Type:** `text/plain; charset=utf-8` (Markdown source)
- Body: contents of `deno/api_doc.md`

**Errors**

| Status | Reason |
|--------|--------|
| `500` | Documentation file could not be read |

---

### `GET /docs/html`

Return this API reference rendered as HTML with GitHub-flavored Markdown styling ([@deno/gfm](https://deno.land/x/gfm)).

```bash
curl http://localhost:3003/docs/html
```

**Response** `200`

- **Content-Type:** `text/html; charset=utf-8`
- Full HTML page with GFM CSS, suitable for browser viewing

Production example:

```
https://api.shadowing.app.aidimsum.com/docs/html
```

**Errors**

| Status | Reason |
|--------|--------|
| `500` | Documentation file could not be read |

---

## Transcription

### `POST /api/transcribe`

Transcribe Cantonese audio via OpenRouter STT (`/v1/audio/transcriptions`).  
Legacy alias: `POST /api/trans_cantonese`

**Content-Type:** `multipart/form-data`

| Field | Required | Description |
|-------|----------|-------------|
| `file` | Yes | Audio file (wav, mp3, m4a, webm, …) |
| `language` | No | Default `yue` |
| `prompt` | No | Optional context hint |
| `task` | No | `transcribe` (default) or `translate` |

```bash
curl -X POST http://localhost:3003/api/transcribe \
  -F "file=@public/audio/yue1.m4a" \
  -F "language=yue" \
  -F "task=transcribe"
```

**Response** `200`

```json
{
  "text": "我唔食辣嘢"
}
```

**Errors**

| Status | Reason |
|--------|--------|
| `400` | Missing `file` |
| `500` | Missing `API_KEY` or transcription failed |

---

## Jyutping

### `GET /api/to_jyutping`

### `POST /api/to_jyutping`

Convert Cantonese text to Jyutping.

**GET** — query param `text`  
**POST** — JSON body `{ "text": "..." }`

```bash
curl "http://localhost:3003/api/to_jyutping?text=长老"

curl -X POST http://localhost:3003/api/to_jyutping \
  -H "Content-Type: application/json" \
  -d '{"text":"长老"}'
```

**Response** `200`

```json
{
  "text": "长老",
  "jyutping": "zoeng2 lou5",
  "content": "长(zoeng2)老(lou5)",
  "list": [
    { "character": "长", "jyutping": "zoeng2" },
    { "character": "老", "jyutping": "lou5" }
  ]
}
```

| Field | Description |
|-------|-------------|
| `jyutping` | Space-separated syllables |
| `content` | Inline `字(jyutping)` format used in the app |
| `list` | Per-character mapping |

**Errors**

| Status | Reason |
|--------|--------|
| `400` | Missing `text` |

---

## Libraries (CRUD)

Backed by Supabase table `app_lib_shadowing_game`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | bigint | Auto-generated primary key |
| `name` | text | Required |
| `description` | text | Required |
| `item_index_collection` | jsonb | Default `[]` |
| `creator_email` | text | Required |
| `user_data` | jsonb | Default `[]` |
| `data_table` | text | Default `cantonese_corpus_all` |
| `created_at` | timestamptz | Auto |
| `updated_at` | timestamptz | Auto on update |

Create, update, and delete require a `passwd` field matching the corresponding env var.

---

### `GET /api/libs`

List libraries.

| Query | Description |
|-------|-------------|
| `creator_email` | Filter by creator |
| `data_table` | Filter by data table |
| `limit` | Page size, 1–200, default `50` |
| `offset` | Offset, default `0` |

```bash
curl http://localhost:3003/api/libs

curl "http://localhost:3003/api/libs?creator_email=alice@example.com&limit=10&offset=0"

curl "http://localhost:3003/api/libs?data_table=cantonese_corpus_all"
```

**Response** `200`

```json
{
  "data": [
    {
      "id": 1,
      "name": "我的语料集",
      "description": "日常粤语",
      "item_index_collection": [],
      "creator_email": "alice@example.com",
      "user_data": [],
      "data_table": "cantonese_corpus_all",
      "created_at": "2026-06-02T12:00:00.000Z",
      "updated_at": "2026-06-02T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### `GET /api/libs/:id`

Get one library by id.

```bash
curl http://localhost:3003/api/libs/1
```

**Response** `200`

```json
{
  "data": { "...": "..." }
}
```

**Errors**

| Status | Reason |
|--------|--------|
| `400` | Invalid id |
| `404` | Not found |

---

### `POST /api/libs`

Create a library. Requires `passwd` = `LIB_CREATE_PASSWD`.

| Field | Required | Description |
|-------|----------|-------------|
| `passwd` | Yes | Create password |
| `name` | Yes | Library name |
| `description` | Yes | Description |
| `creator_email` | Yes | Creator email |
| `data_table` | No | Default `cantonese_corpus_all` |
| `item_index_collection` | No | Default `[]` |
| `user_data` | No | Default `[]` |

```bash
curl -X POST http://localhost:3003/api/libs \
  -H "Content-Type: application/json" \
  -d '{
    "passwd": "YOUR_LIB_CREATE_PASSWD",
    "name": "我的语料集",
    "description": "日常粤语",
    "creator_email": "alice@example.com",
    "data_table": "cantonese_corpus_all",
    "item_index_collection": [],
    "user_data": []
  }'
```

**Response** `201`

```json
{
  "data": { "...": "..." }
}
```

**Errors**

| Status | Reason |
|--------|--------|
| `401` | Invalid `passwd` |
| `400` | Missing required fields |
| `500` | Supabase not configured |

---

### `PATCH /api/libs/:id`

Update a library (partial). Requires `passwd` = `LIB_UPDATE_PASSWD`.

Updatable fields: `name`, `description`, `creator_email`, `data_table`, `item_index_collection`, `user_data`

```bash
curl -X PATCH http://localhost:3003/api/libs/1 \
  -H "Content-Type: application/json" \
  -d '{
    "passwd": "YOUR_LIB_UPDATE_PASSWD",
    "description": "更新后的描述",
    "data_table": "cantonese_corpus_all",
    "item_index_collection": [1, 2, 3]
  }'
```

**Response** `200`

```json
{
  "data": { "...": "..." }
}
```

**Errors**

| Status | Reason |
|--------|--------|
| `401` | Invalid `passwd` |
| `400` | No updatable fields |
| `404` | Not found |

---

### `DELETE /api/libs/:id`

Delete a library. Requires `passwd` = `LIB_DELETE_PASSWD`.

Pass `passwd` as query param or JSON body:

```bash
curl -X DELETE "http://localhost:3003/api/libs/1?passwd=YOUR_LIB_DELETE_PASSWD"

curl -X DELETE http://localhost:3003/api/libs/1 \
  -H "Content-Type: application/json" \
  -d '{"passwd":"YOUR_LIB_DELETE_PASSWD"}'
```

**Response** `200`

```json
{
  "success": true,
  "data": { "...": "..." }
}
```

**Errors**

| Status | Reason |
|--------|--------|
| `401` | Invalid `passwd` |
| `404` | Not found |

---

## Quick reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | API greeting |
| GET | `/health` | — | Health check |
| GET | `/docs` | — | API docs (Markdown) |
| GET | `/docs/html` | — | API docs (HTML) |
| POST | `/api/transcribe` | `API_KEY` | Transcribe audio |
| POST | `/api/trans_cantonese` | `API_KEY` | Transcribe (legacy alias) |
| GET/POST | `/api/to_jyutping` | — | Text → Jyutping |
| GET | `/api/libs` | — | List libraries |
| GET | `/api/libs/:id` | — | Get library |
| POST | `/api/libs` | `LIB_CREATE_PASSWD` | Create library |
| PATCH | `/api/libs/:id` | `LIB_UPDATE_PASSWD` | Update library |
| DELETE | `/api/libs/:id` | `LIB_DELETE_PASSWD` | Delete library |

---

## Local development

```bash
cd deno
deno task dev
```

Server runs at `http://localhost:3003` (see `deno/deno.json`).

Open **http://localhost:3003/docs/html** in a browser to read this documentation.
