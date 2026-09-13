// netlify/functions/log-habit.js
import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Whole days between two YYYY-MM-DD strings (b - a).
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export default async (req, context) => {
  // Only allow POST requests for saving data
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  // The signed-in user is the source of truth — never trust a userId from the body,
  // otherwise anyone could read or overwrite another person's history.
  const userId = context.clientContext?.user?.sub;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { habitId, completedDate } = payload ?? {};

  if (typeof habitId !== "string" || !ID_PATTERN.test(habitId)) {
    return json({ error: "Invalid habitId" }, 400);
  }
  if (
    typeof completedDate !== "string" ||
    !DATE_PATTERN.test(completedDate) ||
    Number.isNaN(Date.parse(`${completedDate}T00:00:00Z`))
  ) {
    return json({ error: "Invalid completedDate, expected YYYY-MM-DD" }, 400);
  }
  if (daysBetween(completedDate, new Date().toISOString().slice(0, 10)) < 0) {
    return json({ error: "completedDate cannot be in the future" }, 400);
  }

  try {
    // ---------------------------------------------------------
    // 1. THE HISTORY: Insert a permanent record into Postgres
    // ---------------------------------------------------------
    // Netlify automatically injects your DATABASE_URL environment variable
    const sql = neon(Netlify.env.get("DATABASE_URL"));

    // Requires UNIQUE (user_id, habit_id, completed_date) so a double-tap
    // doesn't create duplicate rows.
    await sql`
      INSERT INTO habit_history (user_id, habit_id, completed_date)
      VALUES (${userId}, ${habitId}, ${completedDate})
      ON CONFLICT (user_id, habit_id, completed_date) DO NOTHING
    `;

    // ---------------------------------------------------------
    // 2. THE CACHE: Overwrite the instant-read JSON Blob
    // ---------------------------------------------------------
    const summaryStore = getStore("user-summaries");
    const blobKey = `summary_${userId}`;

    // Fetch the user's current cached state (or default to empty)
    const currentSummary = (await summaryStore.get(blobKey, { type: "json" })) || { habits: {} };
    const previous = currentSummary.habits[habitId];

    // A streak only continues if the previous entry was the day before.
    let streak = 1;
    if (previous?.lastCompleted) {
      const gap = daysBetween(previous.lastCompleted, completedDate);
      if (gap === 0) streak = previous.streak || 1;          // already logged today
      else if (gap === 1) streak = (previous.streak || 0) + 1; // consecutive day
    }

    currentSummary.habits[habitId] = {
      lastCompleted: completedDate > (previous?.lastCompleted ?? "") ? completedDate : previous.lastCompleted,
      streak,
    };

    // Save the fully updated JSON object back to the edge CDN
    await summaryStore.setJSON(blobKey, currentSummary);

    // Return the updated summary so the frontend can update instantly
    return json({ success: true, data: currentSummary });
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to log habit" }, 500);
  }
};
