# Screenshot Inbox

Screenshot Inbox turns those screenshots into structured, searchable memories.

Upload screenshots → AI understands them → metadata is stored → semantic search helps you find what you're looking for later.

## ✨ What It Does

Screenshot Inbox lets you:

* 📸 Upload one or many screenshots
* 🤖 Use AI to understand what's in each screenshot
* 🏷️ Automatically classify screenshots into categories
* 🎯 Infer the likely intent behind a screenshot
* 📝 Generate a title and description
* 🔎 Search using natural language
* 🧠 Use semantic search instead of relying only on keywords
* 🚫 Detect exact duplicate screenshots
* 🖼️ Preview screenshots in a larger view
* 🗂️ Filter screenshots by category
* 🗑️ Delete screenshots you no longer need


## 🧠 How AI Understands Screenshots

Each uploaded screenshot is analyzed using Google's Gemini models.

For every screenshot, the system attempts to determine:

### Category

* `food`
* `product`
* `shopping`
* `travel`
* `activity`
* `event`
* `article`
* `place`
* `other`

### Intent

* `try`
* `buy`
* `do`
* `visit`
* `watch`
* `read`

It also generates:

* **Title** — the main thing worth remembering
* **Description** — a short explanation of what the screenshot represents

The resulting metadata is stored alongside the original screenshot.


## 🔎 Semantic Search

Screenshot Inbox uses vector embeddings to make screenshots searchable by meaning.

When a screenshot is analyzed, its title, description, category, and intent are converted into a vector embedding.

Search queries are embedded in the same vector space.

The application then uses PostgreSQL + `pgvector` to find screenshots with similar semantic meaning.

This means a query doesn't need to contain the exact words used in the screenshot metadata.

For example:

```text
"places I should visit"
```

can surface screenshots categorized around travel or places even if the original metadata doesn't contain those exact words.


## 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │     Next.js App     │
                    │     React UI        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Upload API        │
                    │   /api/screenshots  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     PostgreSQL      │
                    │                     │
                    │ Screenshot metadata │
                    │ SHA-256 file hash   │
                    │ Vector embeddings  │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Gemini AI      │
                    │                     │
                    │ Image understanding │
                    │ Classification      │
                    │ Intent extraction   │
                    │ Embeddings          │
                    └─────────────────────┘
```


## 🛠️ Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Backend

* Next.js API Routes
* Node.js

### Database

* PostgreSQL
* Prisma ORM
* pgvector

### AI

* Google Gemini
* `gemini-3.5-flash-lite` for image analysis
* `gemini-embedding-2` for semantic embeddings

### Storage

Screenshots are currently stored locally in:

```text
public/uploads/
```


## 🗄️ Database Schema

Each screenshot is represented by a `Screenshot` record containing information such as:

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

The `fileHash` is a SHA-256 hash of the original uploaded file.

This allows the application to detect when the exact same screenshot has already been uploaded.

The `embedding` field stores a 768-dimensional vector used for semantic search.


## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yanniewu/screenshot-inbox.git
cd screenshot-inbox
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the environment file

Create a `.env` file:

```env
DATABASE_URL="postgresql://USER@localhost:5432/screenshot_inbox"
GEMINI_API_KEY="your_gemini_api_key"
```


### 4. Set up PostgreSQL

Create a PostgreSQL database named:

```text
screenshot_inbox
```

Make sure PostgreSQL is running locally.

### 5. Enable pgvector

Inside PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 6. Set up Prisma

Run:

```bash
npx prisma db push
npx prisma generate
```

### 7. Start the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## 🎯 Current Features

* [x] Screenshot upload
* [x] Multiple screenshot upload
* [x] Image preview
* [x] AI image understanding
* [x] Automatic categorization
* [x] Intent extraction
* [x] AI-generated titles
* [x] AI-generated descriptions
* [x] PostgreSQL storage
* [x] Prisma ORM
* [x] pgvector integration
* [x] Semantic search
* [x] Category filtering
* [x] Exact duplicate detection
* [x] Screenshot preview modal
* [x] Screenshot deletion


## 🗺️ Roadmap

Potential future improvements include:

### Better Storage

 Store screenshots on the cloud instead of locally.

### Smarter Screenshot Understanding

Extract structured information such as:

* restaurant names
* addresses
* product names
* prices
* brands
* dates
* event names
* URLs
* people
* locations

### Better Duplicate Detection

Add perceptual hashing so visually identical or near-identical screenshots can be detected even when the underlying files differ.

### Better Search

Combine:

* semantic search
* keyword search
* metadata filters
* structured entities
* recency

to make queries more precise.

### Personal AI Memory Layer

Move from simple search toward questions such as:

```text
"What restaurants have I saved near me?"

"What clothes did I want to buy?"

"What activities have I saved for this weekend?"

"Show me travel ideas I saved for Japan."

"What were those shoes I screenshot last month?"
```

### Agentic Workflows

Eventually, the system could take actions based on saved screenshots, such as:

* finding restaurant locations
* organizing travel ideas
* grouping saved products
* identifying upcoming events
* creating personalized recommendation lists

---
