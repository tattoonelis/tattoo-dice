import { getStore } from "@netlify/blobs";

const STORE_NAME = "tattoo-dice";
const COUNTER_KEY = "ideas-rolled";

export default async (request, context) => {
  const headers = {
    "content-type": "application/json",
    "cache-control": "no-store"
  };

  try {
    const store = getStore(STORE_NAME);

    const currentValue = await store.get(COUNTER_KEY, {
      type: "json",
      consistency: "strong"
    });

    let count = Number(currentValue?.count || 0);

    if (request.method === "POST") {
      count += 1;
      await store.setJSON(COUNTER_KEY, { count });
    }

    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("roll-counter error:", error);

    return new Response(JSON.stringify({
      error: "counter_unavailable",
      message: error?.message || "Unknown counter error"
    }), {
      status: 500,
      headers
    });
  }
};
