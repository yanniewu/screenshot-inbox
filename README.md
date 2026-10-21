# Screenshot Inbox

**Turn screenshots into structured, searchable memories.**

[**Try Screenshot Inbox →**](https://screenshot-inbox-5ftxqevo0-yannie1.vercel.app/)

Screenshot Inbox is an AI-powered visual inbox that helps you save, organize, and rediscover screenshots. Upload images, let AI understand their contents, and find what you need later with natural-language semantic search.

## ✨ Features

- 📸 **Single and multiple uploads** — Upload PNG, JPEG, WebP, and GIF images up to 10 MB each.
- 🤖 **AI-powered image understanding** — Analyze screenshots using Google Gemini.
- 🏷️ **Automatic categorization** — Organize screenshots by their content.
- 🎯 **Intent detection** — Infer whether a screenshot represents something to try, buy, do, visit, watch, or read.
- 📝 **AI-generated metadata** — Generate a descriptive title and summary for each screenshot.
- 🔎 **Semantic search** — Find screenshots by meaning, not just exact keyword matches.
- 🚫 **Duplicate detection** — Detect exact duplicate files using SHA-256 hashes.
- 🗂️ **Category filtering** — Browse screenshots by category.
- 🖼️ **Image previews** — Open screenshots in a larger view.
- 🗑️ **Screenshot deletion** — Remove screenshots and attempt to delete their stored images.

## 🧠 AI-Powered Screenshot Understanding

Each screenshot is analyzed using Google's Gemini models. The application attempts to identify the screenshot's main subject and generate useful metadata.

### Categories

- `food`
- `product`
- `shopping`
- `travel`
- `activity`
- `event`
- `article`
- `place`
- `other`

### Intent

- `try`
- `buy`
- `do`
- `visit`
- `watch`
- `read`

Each analyzed screenshot can include:

- **Title** — A short, memorable label.
- **Description** — A concise explanation of what the screenshot represents.
- **Category** — A classification of its content.
- **Intent** — The likely reason for saving it.
- **Embedding** — A vector representation used for semantic search.

AI-generated metadata is intended to help organize screenshots and may not always be accurate.

## 🔎 Semantic Search

Screenshot Inbox uses vector embeddings to make screenshots searchable by meaning.

1. Gemini analyzes a screenshot and generates descriptive metadata.
2. The metadata is converted into a vector embedding.
3. The embedding is stored in PostgreSQL using `pgvector`.
4. When you search, the query is embedded in the same vector space.
5. The application retrieves screenshots with similar semantic meaning.

For example, searching for:

```text
places I want to visit
```

can surface travel ideas or saved places even when the screenshot's metadata uses different wording.

## 🏗️ Architecture

Screenshot Inbox uses direct browser-to-Blob uploads so the original image does not need to pass through a serverless function's request body.

```text
                    Browser / React UI
                            |
                +-----------+-----------+
                |                       |
                v                       v
        /api/blob-upload          /api/search
                |                       |
                v                       v
          Vercel Blob             Gemini Embeddings
                |
                v
     /api/screenshots/register
                |
                v
          PostgreSQL
          + pgvector
                ^
                |
             /api/ai
                |
                v
           Gemini AI
      Image understanding
      Metadata generation
      Embedding generation
```

### Upload and processing flow

1. The browser requests upload authorization from `/api/blob-upload`.
2. The image is uploaded directly to Vercel Blob.
3. `/api/screenshots/register` records the Blob URL and SHA-256 file hash in PostgreSQL.
4. The application sends the screenshot for AI analysis through `/api/ai`.
5. The generated metadata and embedding are stored in the database.
6. Semantic search uses `/api/search` to find relevant screenshots.

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js Route Handlers, Node.js |
| Database | PostgreSQL |
| ORM | Prisma |
| Vector search | pgvector |
| Image storage | Vercel Blob |
| AI integration | Google Gemini via `@google/genai` |
| Deployment | Vercel |

### AI models

- `gemini-3.5-flash-lite` — Screenshot image analysis and metadata generation.
- `gemini-embedding-2` — Semantic embeddings.

## 🗄️ Database

Each screenshot is represented by a `Screenshot` record in PostgreSQL.

The record includes fields such as:

```text
id
imageUrl
createdAt
category
intent
title
description
embedding
processingStatus
fileHash
```

- **`imageUrl`** stores the screenshot's image URL, typically pointing to Vercel Blob.
- **`fileHash`** stores the SHA-256 hash of the original file for exact duplicate detection.
- **`embedding`** stores a 768-dimensional vector used for semantic search.
- **`processingStatus`** tracks the screenshot's processing state.

Prisma manages database access, while `pgvector` enables vector similarity search.


## 🔌 API Routes

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/blob-upload` | Authorize and validate direct image uploads to Vercel Blob |
| `POST` | `/api/screenshots/register` | Register an uploaded image and its file hash |
| `GET` | `/api/screenshots` | Retrieve screenshots, newest first |
| `DELETE` | `/api/screenshots` | Delete a screenshot record and attempt to remove its Blob |
| `POST` | `/api/ai` | Analyze a screenshot and save its metadata and embedding |
| `POST` | `/api/search` | Search screenshots using semantic similarity |

## ⚠️ Current Limitations

- **No user accounts:** The application does not currently provide authentication or per-user access controls. Screenshots belong to a shared application rather than individual users.
- **Exact duplicate detection only:** Different files containing visually identical images may not be detected as duplicates.
- **AI accuracy:** Generated categories, descriptions, and intent classifications may occasionally be incorrect.

## 🗺️ Roadmap

### Smarter Screenshot Understanding

Extract structured details such as:

- Restaurant and business names
- Addresses and locations
- Product names, brands, and prices
- Dates and event details
- URLs and other useful references

### Better Duplicate Detection

Add perceptual hashing to identify visually identical or near-identical screenshots even when their file contents differ.

### Improved Search

Combine semantic search with keyword matching, metadata filters, structured entities, and recency-based ranking.

### More Organization Tools

Add favorites, trash, collections, and additional ways to organize saved screenshots.

### Agentic Workflows

Explore workflows that turn screenshots into useful actions, such as:

- Finding restaurants and places on a map
- Organizing travel ideas into itineraries
- Grouping saved products into shopping lists
- Identifying upcoming events
- Generating personalized recommendation lists

---
