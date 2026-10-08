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
  const [selectedScreenshot, setSelectedScreenshot] =
    useState<Screenshot | null>(null);

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
    if (files) setTotalPhotos(files.length);

    if (!files || files.length === 0) return;

    setSaved(false);
    setUploading(true);
    setCompletedPhotos(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Get current image number
        setProcessingIndex(i + 1);

        // Show the current image
        const previewUrl = URL.createObjectURL(file);
        setImage(previewUrl);

        // Resize image for Gemini
        const resizedImage = await resizeImage(file);

        // Save original screenshot
        const uploadFormData = new FormData();

        uploadFormData.append("file", file);

        const uploadResponse = await fetch("/api/screenshots", {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          if (uploadResponse.status === 409) {
            const duplicateData = await uploadResponse.json();

            alert(duplicateData.error || `${file.name} is already in your library.`);
            continue;
          }

          throw new Error(
            `Failed to upload ${file.name}`
          );
        }

        const savedScreenshot = await uploadResponse.json();

        setSaved(true);

        // Send resized image to Gemini
        const aiFormData = new FormData();

        aiFormData.append(
          "file",
          resizedImage,
          "screenshot.jpg"
        );

        aiFormData.append(
          "screenshotId",
          savedScreenshot.id
        );

        const aiResponse = await fetch("/api/ai", {
          method: "POST",
          body: aiFormData,
        });

        if (!aiResponse.ok) {
          throw new Error(
            `AI analysis failed for ${file.name}`
          );
        }

        await aiResponse.json();

        // Clean up preview URL
        URL.revokeObjectURL(previewUrl);
      }

      // Reload inbox after all screenshots finish
      await loadScreenshots();
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
      setImage(null)
      setCompletedPhotos(files.length);
    }

    // Allow selecting the same files again later
    event.target.value = "";
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