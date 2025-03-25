"use client";

export function WatchStreamForm() {
  return (
    <input
      type="text"
      placeholder="Enter Stream ID"
      className="w-full p-2 border rounded-lg mb-4"
      onChange={(e) => {
        const streamId = e.target.value.trim();
        if (streamId) {
          window.location.href = `/watch/${streamId}`;
        }
      }}
    />
  );
} 