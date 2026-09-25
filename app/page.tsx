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
    "place",
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
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">

        <h1 className="text-3xl font-bold text-gray-900">
          Screenshot Inbox
        </h1>

        <p className="mt-2 text-gray-600">
          Automatically organize and search your screenshots.
        </p>

        {/* Upload */}
        <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 bg-white p-10 text-center">
          {/* <h2 className="text-xl font-semibold text-gray-800">
            Add a screenshot
          </h2> */}

          <label
            className={`mt-6 inline-block rounded-lg px-5 py-3 text-white ${uploading
              ? "cursor-not-allowed bg-gray-400"
              : "cursor-pointer bg-black hover:bg-gray-800"
              }`}
          >
            {"Choose Screenshots"}

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {uploading && (
            <p className="mt-2 text-sm text-gray-500">
              Uploading {processingIndex} out of {totalPhotos}{" "}
              {totalPhotos === 1 ? "screenshot" : "screenshots"}.
            </p>
          )}

          {!uploading && completedPhotos > 0 && (
            <p className="mt-3 text-sm font-medium text-green-600">
              Finished uploading {completedPhotos}{" "}
              {completedPhotos === 1 ? "screenshot" : "screenshots"}.
            </p>
          )}

          {image && (
            <div className="mt-6">
              <img
                src={image}
                alt="Uploaded screenshot"
                className="mx-auto max-h-64 rounded-lg shadow"
              />
            </div>
          )}
        </div>

        {/* Inbox */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Your Screenshots
            </h2>

            <span className="text-sm text-gray-500">
              {filteredScreenshots.length} shown
            </span>
          </div>

          <div className="mt-5 flex gap-2">
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
              placeholder="Ask your screenshot memory..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-500"
            />

            <button
              onClick={handleSemanticSearch}
              disabled={searching || !searchQuery.trim()}
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${selectedCategory === category
                  ? "bg-black text-white"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                  }`}
              >
                {category === "all"
                  ? "All"
                  : category.charAt(0).toUpperCase() +
                  category.slice(1)}
              </button>
            ))}
          </div>

          {filteredScreenshots.length === 0 ? (
            <div className="mt-6 rounded-xl bg-white p-10 text-center text-gray-500">
              {searchQuery || selectedCategory != "all"
                ? "No screenshots match your search."
                : "No screenshots yet."}
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredScreenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  onClick={() => setSelectedScreenshot(screenshot)}
                  className="cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <img
                    src={screenshot.imageUrl}
                    alt={screenshot.title ?? "Screenshot"}
                    className="h-64 w-full object-cover"
                  />

                  <div className="p-5">
                    <div className="mt-3 flex flex-wrap gap-2">
                      {screenshot.category && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {screenshot.category}
                        </span>
                      )}

                      {screenshot.intent && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {screenshot.intent}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900">
                      {screenshot.title ?? "Untitled screenshot"}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {screenshot.description ??
                        "AI analysis pending..."}
                    </p>

                    <button
                      onClick={() => handleDelete(screenshot.id)}
                      className="mt-4 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
     {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <img
            src={selectedScreenshot.imageUrl}
            alt={selectedScreenshot.title ?? "Screenshot"}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </main>
  );
}