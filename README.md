# Enterprise Knowledge Base Chatbot

A production-grade Retrieval-Augmented Generation (RAG) backend built with **NestJS**, **Gemini 2.5 Flash**, and **ChromaDB**. Upload PDF documents, they get chunked and embedded into a vector store, and users ask questions that are answered strictly from the ingested content — no hallucinations.

This is the foundation for an AI Engineering course. The architecture is intentionally layered so future lessons (Ragas evaluation, Redis memory, hybrid search, auth, streaming, observability) can be added as **new modules**, not rewrites.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Backend framework | NestJS + TypeScript |
| LLM | Gemini 2.5 Flash (`@google/genai`) |
| Embeddings | Gemini Embedding Model (`gemini-embedding-001`) |
| Vector database | ChromaDB |
| File upload | Multer (in-memory, PDF only, 10MB cap) |
| PDF parsing | `pdf-parse` |
| Validation | `class-validator` / `class-transformer` |
| Frontend | HTML + Tailwind CSS (CDN) + vanilla JS |

---

## 2. Project Structure

```
rag chroma db/
├── src/
│   ├── main.ts                        # Bootstrap: global pipes/filters, CORS, port
│   ├── app.module.ts                  # Root module: config, static frontend, feature modules
│   │
│   ├── config/
│   │   ├── configuration.ts           # Typed AppConfig factory (reads process.env)
│   │   └── env.validation.ts          # class-validator schema, fails fast on bad/missing env
│   │
│   ├── common/
│   │   ├── constants/rag.constants.ts # DI tokens (VECTOR_STORE, EMBEDDING_PROVIDER), shared strings
│   │   ├── filters/global-exception.filter.ts   # Catches every error -> clean JSON + status code
│   │   └── interceptors/logging.interceptor.ts  # Request/response timing logs
│   │
│   ├── embedding/
│   │   ├── embedding-provider.interface.ts   # EmbeddingProvider contract (provider-agnostic)
│   │   ├── gemini-embedding.service.ts       # Gemini implementation of the contract
│   │   └── embedding.module.ts               # Binds EMBEDDING_PROVIDER token -> Gemini impl
│   │
│   ├── vector-store/
│   │   ├── vector-store.interface.ts         # VectorStore contract (provider-agnostic)
│   │   ├── chroma-vector-store.service.ts    # ChromaDB implementation of the contract
│   │   └── vector-store.module.ts            # Binds VECTOR_STORE token -> Chroma impl
│   │
│   ├── knowledge/                     # Everything behind POST /knowledge/upload
│   │   ├── knowledge.controller.ts    # Upload endpoint, file validation
│   │   ├── knowledge.service.ts       # Orchestrates parse -> chunk -> embed -> store
│   │   ├── knowledge.module.ts
│   │   ├── pdf/pdf.service.ts         # Extract text, clean artifacts, convert to markdown
│   │   ├── chunking/chunking.service.ts # Recursive, heading-aware, overlapping chunker
│   │   └── dto/upload-response.dto.ts
│   │
│   ├── rag/                           # Everything behind POST /chat
│   │   ├── rag.service.ts             # Orchestrates embed -> search -> prompt -> generate
│   │   ├── rag.module.ts
│   │   ├── gemini-chat.service.ts     # Gemini generation call
│   │   └── prompt/prompt-builder.service.ts # Secure "answer only from context" system prompt
│   │
│   └── chat/
│       ├── chat.controller.ts         # POST /chat
│       ├── chat.service.ts            # Thin delegation to RagService
│       ├── chat.module.ts
│       └── dto/chat-request.dto.ts, dto/chat-response.dto.ts
│
├── public/
│   ├── index.html                     # Split layout: upload panel (left) + chat panel (right)
│   └── app.js                         # Drag & drop upload, progress steps, chat UX, typing animation
│
├── uploads/.gitkeep                   # Placeholder (uploads are handled in-memory, not persisted)
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── nest-cli.json
```

### Why this shape?

- **Interfaces + DI tokens for Embedding and Vector Store** (`EMBEDDING_PROVIDER`, `VECTOR_STORE`): `KnowledgeService` and `RagService` never import Gemini or Chroma directly — they depend on interfaces. Swapping Chroma for Pinecone, or Gemini embeddings for another provider, means writing one new class and changing one line in a module file.
- **`rag/` as the orchestration layer**: retrieval, prompt-building, and generation are separate services composed by `RagService`. This is exactly where Ragas evaluation (Video 21) and Redis-backed conversation memory (Video 22) plug in later — as new steps in `RagService`, without touching `ChatController` or `KnowledgeService`.
- **A single `GlobalExceptionFilter`**: every unhandled error, from any layer, becomes a clean JSON response with the right HTTP status. The process never crashes on bad input or a downstream API failure.

---

## 3. File-by-File Explanation

**Config**
- `config/configuration.ts` — one typed object (`AppConfig`) that every service reads through `ConfigService`, instead of scattering `process.env.X` calls across the codebase.
- `config/env.validation.ts` — validates env vars at boot (via `class-validator`); the app refuses to start with a missing `GEMINI_API_KEY` instead of failing on the first request.

**Common**
- `common/constants/rag.constants.ts` — the `VECTOR_STORE` / `EMBEDDING_PROVIDER` Symbol tokens used for interface-based dependency injection, plus the fixed "not found in knowledge base" message.
- `common/filters/global-exception.filter.ts` — catches literally everything (`@Catch()` with no argument), logs 5xx as errors and 4xx as warnings, and always responds with `{ success, statusCode, path, timestamp, message }`.
- `common/interceptors/logging.interceptor.ts` — logs method, URL, and duration for every request.

**Embedding**
- `embedding/embedding-provider.interface.ts` — `embedText(text)` and `embedBatch(texts)`.
- `embedding/gemini-embedding.service.ts` — calls `gemini-embedding-001` in batches (chunked to respect Gemini's per-request limits), throws a clean `InternalServerErrorException` on failure.

**Vector Store**
- `vector-store/vector-store.interface.ts` — `addDocuments(docs)` and `querySimilar(embedding, topK)`, plus the `VectorDocument` / `VectorQueryResult` shapes.
- `vector-store/chroma-vector-store.service.ts` — talks to ChromaDB over HTTP, converts Chroma's cosine *distance* into a 0–1 *similarity* score, and never lets Chroma auto-generate embeddings (we always supply Gemini's).

**Knowledge (upload pipeline)**
- `knowledge/pdf/pdf.service.ts` — `pdf-parse` extraction, whitespace/hyphenation cleanup, and a lightweight heading heuristic that promotes short standalone lines to `## Markdown headings` so the chunker can use them as natural boundaries.
- `knowledge/chunking/chunking.service.ts` — recursive splitter: tries heading breaks, then paragraph breaks, then sentence breaks, then word breaks, falling back to a hard character split only if a single sentence exceeds the chunk size. Produces 800-character chunks with 150-character overlap.
- `knowledge/knowledge.service.ts` — orchestrates the full pipeline and attaches metadata (`filename`, `pageCount`, `uploadTimestamp`, `chunkId`, `documentId`, `heading`) to every chunk before storing it.
- `knowledge/knowledge.controller.ts` — `POST /knowledge/upload`; validates MIME type, size, and emptiness before any processing happens.

**RAG + Chat (query pipeline)**
- `rag/prompt/prompt-builder.service.ts` — the single source of truth for the "answer only from context, never hallucinate, say '*I couldn't find this information in the uploaded knowledge base.*' otherwise" instruction.
- `rag/gemini-chat.service.ts` — wraps `gemini-2.5-flash` generation.
- `rag/rag.service.ts` — embeds the question, retrieves top-K chunks from Chroma, short-circuits to the "not found" message if nothing relevant exists, otherwise builds the prompt and generates the answer, then returns de-duplicated source filenames.
- `chat/chat.controller.ts` + `chat/dto/chat-request.dto.ts` — `POST /chat`; rejects empty/whitespace-only questions via DTO validation before the request reaches any service.

**Frontend**
- `public/index.html` — two-column layout: Knowledge Upload (left), AI Chat (right), Tailwind via CDN.
- `public/app.js` — drag & drop + click-to-browse upload with a real upload-progress bar (XHR) that hands off to a simulated step list (*Parsing → Cleaning → Chunking → Embeddings → Saving → Ready*) while the server finishes processing; chat UI with typing animation, auto-scroll, a cycling status strip (*Searching → Building Context → Thinking → Generating*), and source-filename chips under each answer.

---

## 4. Future Extensibility (by design, no rewrites needed)

| Feature | Where it plugs in |
|---|---|
| Ragas Evaluation (Video 21) | New `evaluation` module wrapping `RagService.answerQuestion()` calls; reads the same `VectorQueryResult[]` already returned internally. |
| Redis Memory (Video 22) | New `MemoryModule` injected into `RagService`/`ChatService` to prepend prior turns to the prompt; `ChatRequestDto` gains an optional `conversationId`. |
| Pinecone / Hybrid Search | New class implementing `VectorStore`; swap the binding in `vector-store.module.ts`. Nothing else changes. |
| Metadata Filtering | Extend `VectorStore.querySimilar` signature with an optional filter param; Chroma already supports `where` clauses. |
| Streaming Responses | Swap `GeminiChatService.generateAnswer` for `generateContentStream` and expose an SSE endpoint alongside the existing one. |
| Auth / Multi-user | New `AuthModule` + Nest guards on `ChatController`/`KnowledgeController`; metadata already carries `documentId` for per-user scoping. |
| Conversation History | Persist `{ question, answer, sources }` per request in the future memory store; `ChatResponseDto` is already a stable contract. |
| Rate Limiting / Caching / Observability | Standard Nest interceptors/guards (`@nestjs/throttler`, a caching interceptor, OpenTelemetry) layered on top of existing controllers — no business logic changes. |

---

## 5. Setup & Run

### 5.1 Install dependencies

```bash
npm install
```

### 5.2 Configure environment

Copy the example file and fill in your Gemini API key (get one at https://aistudio.google.com/app/apikey):

```bash
cp .env.example .env
```

`.env.example` contents:

```env
PORT=3000
NODE_ENV=development

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION_NAME=knowledge_base

MAX_UPLOAD_SIZE_MB=10

CHUNK_SIZE=800
CHUNK_OVERLAP=150

RETRIEVAL_TOP_K=5
```

### 5.3 Install ChromaDB

ChromaDB's server ships as a Python package (the JS client in this project just talks to it over HTTP). You need Python 3.9+ installed.

```bash
pip install chromadb
```

### 5.4 Start ChromaDB

```bash
chroma run --path ./chroma-data --port 8000
```

Leave this running in its own terminal. It exposes the HTTP API at `http://localhost:8000`, which matches `CHROMA_URL` in `.env`. `./chroma-data` is where Chroma persists its index between restarts (already git-ignored).

### 5.5 Run the NestJS app

In a second terminal, from the project root:

```bash
npm run start:dev
```

You should see:

```
Enterprise RAG Knowledge Base API running on http://localhost:3000
```

### 5.6 Open the app

```
http://localhost:3000
```

The frontend is served as a static file directly by NestJS (`ServeStaticModule`) — no separate frontend server needed.

---

## 6. Testing the API

### 6.1 Test PDF upload

**Via the browser UI:** drag a PDF onto the left panel, or click it to browse, then click **Upload & Index Document**. Watch it progress through Parsing → Cleaning → Chunking → Embeddings → Saving → Ready.

**Via curl:**

```bash
curl -X POST http://localhost:3000/knowledge/upload \
  -F "file=@/path/to/your/document.pdf"
```

Expected response:

```json
{
  "success": true,
  "message": "Document uploaded and indexed successfully.",
  "filename": "document.pdf",
  "pageCount": 12,
  "chunkCount": 34,
  "uploadedAt": "2026-07-24T10:15:00.000Z"
}
```

Try uploading a non-PDF file or one over 10MB to confirm you get a clean `400 Bad Request` instead of a crash.

### 6.2 Test chat

**Via the browser UI:** type a question in the right panel and press Enter (Shift+Enter for a newline). Watch the status strip cycle, then the answer type out with source filenames underneath.

**Via curl:**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Artificial Intelligence?"}'
```

Expected response:

```json
{
  "answer": "Artificial Intelligence is ...",
  "sources": ["document.pdf"]
}
```

Ask something unrelated to your uploaded documents to confirm you get exactly:

```json
{
  "answer": "I couldn't find this information in the uploaded knowledge base.",
  "sources": []
}
```

Submit an empty question to confirm it's rejected with `400 Bad Request` before any Gemini call is made.

---

## 7. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                   BROWSER                                     │
│   public/index.html + app.js  (Tailwind CSS, vanilla JS)                      │
│   ┌─────────────────────────┐          ┌───────────────────────────────┐     │
│   │  Knowledge Upload panel │          │        AI Chat panel           │     │
│   │  drag & drop / progress │          │  question box / typing anim.   │     │
│   └────────────┬────────────┘          └───────────────┬─────────────---┘     │
└────────────────┼──────────────────────────────────────-─┼────────────────────┘
                  │ multipart/form-data                    │ JSON
                  ▼ POST /knowledge/upload                 ▼ POST /chat
┌──────────────────────────────────────────────────────────────────────────────┐
│                              NESTJS APPLICATION                               │
│                                                                                │
│  Global: ValidationPipe -> Controller -> GlobalExceptionFilter (on error)     │
│                                                                                │
│  ┌───────────────────────────┐        ┌────────────────────────────────┐     │
│  │      KnowledgeModule       │        │            ChatModule          │     │
│  │  KnowledgeController        │        │   ChatController               │     │
│  │  KnowledgeService            │        │   ChatService                  │     │
│  │        │                     │        │        │                       │     │
│  │        ▼                     │        │        ▼                       │     │
│  │  1. PdfService                │        │   RagModule                    │     │
│  │     extract -> clean -> md    │        │   RagService                   │     │
│  │        │                       │        │   1. embed question           │     │
│  │        ▼                       │        │   2. query VectorStore (top5) │     │
│  │  2. ChunkingService             │        │   3. PromptBuilderService     │     │
│  │     recursive, 800/150 overlap  │        │   4. GeminiChatService        │     │
│  │        │                         │        │      (gemini-2.5-flash)      │     │
│  │        ▼                         │        └──────────┬────────────────--┘     │
│  │  3. EmbeddingModule (Gemini)     │                    │                        │
│  │        │                         │                    │                        │
│  │        ▼                         │                    │                        │
│  │  4. VectorStoreModule (Chroma) ◄─┼────────────────────┘                        │
│  └───────────────────────────┘                                                │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                        │ HTTP
                                        ▼
                              ┌──────────────────────┐
                              │       ChromaDB        │
                              │  collection:           │
                              │  knowledge_base         │
                              │  (text + embedding       │
                              │   + metadata per chunk)   │
                              └──────────────────────────┘

                              ┌──────────────────────────┐
                              │     Gemini 2.5 Flash /     │
                              │  gemini-embedding-001       │
                              │  (Google GenAI API)          │
                              └──────────────────────────────┘
```

**Upload flow:** PDF → extract text → clean → markdown → recursive chunk (800/150) → embed each chunk (Gemini) → store `{text, embedding, metadata}` in Chroma.

**Chat flow:** question → embed (Gemini) → similarity search in Chroma (top 5) → assemble context → secure system prompt (answer-only-from-context) → Gemini generation → `{ answer, sources }`.
