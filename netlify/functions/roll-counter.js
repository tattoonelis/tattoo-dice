const { getStore } = require("@netlify/blobs");

const STORE_NAME = "tattoo-dice";
const COUNTER_KEY = "ideas-rolled";

exports.handler = async function(event) {
  try {
    const store = getStore(STORE_NAME);
    const currentValue = await store.get(COUNTER_KEY, { type: "json" });

    let count = Number(currentValue && currentValue.count ? currentValue.count : 0);

    if (event.httpMethod === "POST") {
      count += 1;
      await store.setJSON(COUNTER_KEY, { count });
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({ count })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ count: 0, fallback: true })
    };
  }
};
