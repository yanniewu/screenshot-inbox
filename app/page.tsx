"use client";

import { useEffect, useState } from "react";

type Screenshot = {
  id: string;
  imageUrl: string;
  createdAt: string;
  category: string | null;
  intent: string | null;
  title: string | null;
  description: string | null;
  similarity?: number | null;
  processingStatus: string;
};

export default function Home() {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Screenshot[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [completedPhotos, setCompletedPhotos] = useState(0);
  const [selectedScreenshot, setSelectedScreenshot] =useState<Screenshot | null>(null);
  const [failedUploads, setFailedUploads] = useState<string[]>([]);

  const categories = [
    "all",
    "food",
    "product",
    "shopping",
    "travel",
    "activity",
    "event",
    "article",
    "entertainment",
    "other",
  ];

  const filteredScreenshots = (
    searchResults ?? screenshots
  ).filter((screenshot) => {
    return (
      selectedCategory === "all" ||
      screenshot.category === selectedCategory
    );
  });

  async function loadScreenshots() {
    try {
      const response = await fetch("/api/screenshots");

      if (!response.ok) {
        throw new Error("Failed to load screenshots");
      }

      const data = await response.json();

      setScreenshots(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadScreenshots();
  }, []);

  async function resizeImage(file: File): Promise<Blob> {
    const image = new Image();

    const objectUrl = URL.createObjectURL(file);

    image.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });

    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / image.width);

    const canvas = document.createElement("canvas");

    canvas.width = image.width * scale;
    canvas.height = image.height * scale;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create canvas");
    }

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height
    );

    URL.revokeObjectURL(objectUrl);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not resize image"));
          }
        },
        "image/jpeg",
        0.8
      );
    });
  }

  
async function handleFileChange(
  event: React.ChangeEvent<HTMLInputElement>
) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  setTotalPhotos(files.length);
  setSaved(false);
  setUploading(true);
  setCompletedPhotos(0);
  setFailedUploads([]);

  const failures: string[] = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let previewUrl: string | null = null;
      let savedScreenshotId: string | null = null;

      setProcessingIndex(i + 1);

      try {
        previewUrl = URL.createObjectURL(file);
        setImage(previewUrl);

        // Resize the image for AI analysis.
        const resizedImage = await resizeImage(file);

        // Upload the original screenshot.
        const uploadFormData = new FormData();
        uploadFormData.append("file", file);

        const uploadResponse = await fetch("/api/screenshots", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          let reason = `Upload failed (HTTP ${uploadResponse.status})`;

          try {
            const data = await uploadResponse.json();
            reason = data.error || reason;
          } catch {
            // Use the HTTP status if no JSON response is available.
          }

          throw new Error(reason);
        }

        const savedScreenshot = await uploadResponse.json();
        savedScreenshotId =savedScreenshot.id;
        setSaved(true);

        // Analyze the uploaded screenshot with AI.
        const aiFormData = new FormData();
        aiFormData.append("file", resizedImage, "screenshot.jpg");
        aiFormData.append("screenshotId", savedScreenshot.id);

        const aiResponse = await fetch("/api/ai", {
          method: "POST",
          body: aiFormData,
        });

        if (!aiResponse.ok) {
          let reason = `AI analysis failed (HTTP ${aiResponse.status})`;

          try {
            const data = await aiResponse.json();
            reason = data.error || reason;
          } catch {
            // Use the HTTP status if no JSON response is available.
          }

          throw new Error(reason);
        }

        await aiResponse.json();
      } catch (error) {
  console.error(`Failed to process ${file.name}:`, error);

  let reason =
    error instanceof Error ? error.message : "Unknown error";

  // If the screenshot was saved but later processing failed,
  // delete the screenshot from the database and disk.
  if (savedScreenshotId) {
    try {
      const deleteResponse = await fetch("/api/screenshots", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: savedScreenshotId }),
      });

      if (!deleteResponse.ok) {
        reason += " (Automatic cleanup failed; screenshot may remain.)";
      }
    } catch (deleteError) {
      console.error(
        `Could not clean up ${file.name}:`,
        deleteError
      );
      reason += " (Automatic cleanup failed; screenshot may remain.)";
    }
  }

  failures.push(`${file.name} — ${reason}`);
} finally {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
}

      // Count this file as processed, even if it failed.
      setCompletedPhotos(i + 1);
    }
  } finally {
    setUploading(false);
    setImage(null);
    setCompletedPhotos(files.length);
    event.target.value = "";

    // Save the complete failure list for the popup.
    setFailedUploads(failures);

    // Refresh the inbox after the entire batch.
    await loadScreenshots();
  }
}
  async function handleDelete(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this screenshot?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/screenshots", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete screenshot");
      }

      setScreenshots((current) =>
        current.filter((screenshot) => screenshot.id !== id)
      );
    } catch (error) {
      console.error(error);
      alert("Could not delete screenshot.");
    }
  }

  async function handleSemanticSearch() {
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults(null);
      return;
    }

    setSearching(true);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error("Semantic search failed");
      }

      const results = await response.json();

      setSearchResults(results);
    } catch (error) {
      console.error(error);
      alert("Could not search screenshots.");
    } finally {
      setSearching(false);
    }
  }

  return (
  <main className="dashboard">
    <div className="dashboard-container">

      {/* Top header */}
      <header className="dashboard-header">

        <div className="search-wrapper">
          <span className="search-icon">
            🔍
          </span>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);

              if (!event.target.value.trim()) {
                setSearchResults(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleSemanticSearch();
              }
            }}
            placeholder='Search your screenshots... (e.g. "places to visit", "restaurants in NYC")'
            className="search-input"
          />
        </div>

        <label
          className={`upload-button ${
            uploading ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <span>↑</span>
          {uploading ? "Uploading..." : "Upload Screenshots"}

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>

      </header>

      {/* Page heading */}
      <section className="page-heading">
        <h1>Your Screenshot Inbox</h1>

        <p>
          AI-powered organization and search for your screenshots.
        </p>
      </section>

      {/* Filters */}
      <div className="toolbar">

        <div className="category-list">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`category-button ${
                selectedCategory === category ? "active" : ""
              }`}
            >
              {category === "all"
                ? "All"
                : category.charAt(0).toUpperCase() +
                  category.slice(1)}
            </button>
          ))}
        </div>

        {/* <button className="sort-button">
          Newest ↓
        </button> */}

      </div>

      {/* Screenshots */}
      <section>

        {filteredScreenshots.length === 0 ? (
          <div className="empty-state">
            {searchQuery || selectedCategory !== "all"
              ? "No screenshots match your search."
              : "No screenshots yet."}
          </div>
        ) : (
          <div className="screenshot-grid">

            {filteredScreenshots.map((screenshot) => (
              <div
                key={screenshot.id}
                onClick={() => setSelectedScreenshot(screenshot)}
                className="screenshot-card"
              >

                {/* Image */}
                <div className="screenshot-image-wrapper">

                  <img
                    src={screenshot.imageUrl}
                    alt={screenshot.title ?? "Screenshot"}
                    className="screenshot-image"
                  />

                  {screenshot.category && (
                    <span
                      className={`category-badge ${screenshot.category}`}
                    >
                      {screenshot.category}
                    </span>
                  )}

                </div>

                {/* Content */}
                <div className="screenshot-content">

                  <h3 className="screenshot-title">
                    {screenshot.title ?? "Untitled screenshot"}
                  </h3>

                  <p className="screenshot-description">
                    {screenshot.description ??
                      "AI analysis pending..."}
                  </p>

                  <div className="screenshot-footer">

                    {screenshot.intent && (
                      <span className="intent-badge">
                        {screenshot.intent}
                      </span>
                    )}

                    <span className="screenshot-date">
                      {new Date(
                        screenshot.createdAt
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>

                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(screenshot.id);
                      }}
                      className="delete-button"
                      aria-label="Delete screenshot"
                    >
                     Delete
                    </button>

                  </div>

                </div>

              </div>
            ))}

          </div>
        )}

      </section>

    </div>

    {/* Upload status */}
    {uploading && (
      <div className="upload-status">
        Uploading {processingIndex} of {totalPhotos} screenshots...
      </div>
    )}

{/* Upload failures popup */}
{failedUploads.length > 0 && (
  <div
    className="preview-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="upload-failures-title"
    onClick={() => setFailedUploads([])}
  >
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        background: "white",
        color: "#111827",
        borderRadius: "12px",
        padding: "24px",
        width: "min(560px, calc(100vw - 32px))",
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <h2
        id="upload-failures-title"
        style={{ fontSize: "1.25rem", fontWeight: 700 }}
      >
        {failedUploads.length} file
        {failedUploads.length === 1 ? "" : "s"} failed
      </h2>

      <p style={{ margin: "8px 0 16px" }}>
        Try reuploading the failed file{failedUploads.length === 1 ? "" : "s"}.
      </p>

      <ul
        style={{
          listStyle: "disc",
          paddingLeft: "20px",
          overflowWrap: "anywhere",
        }}
      >
        {failedUploads.map((failure, index) => (
          <li key={index} style={{ marginBottom: "10px" }}>
            {failure}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setFailedUploads([])}
        style={{
          marginTop: "16px",
          padding: "8px 14px",
          borderRadius: "8px",
          background: "#111827",
          color: "white",
        }}
      >
        Close
      </button>
    </div>
  </div>
)}
    {/* Preview */}
    {selectedScreenshot && (
      <div
        className="preview-overlay"
        onClick={() => setSelectedScreenshot(null)}
      >
        <img
          src={selectedScreenshot.imageUrl}
          alt={selectedScreenshot.title ?? "Screenshot"}
          className="preview-image"
        />
      </div>
    )}

  </main>
);
}