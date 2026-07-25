const TEST_PIN = "231189";
let testPinInput = "";

const testPinDisplay = document.getElementById("testPinDisplay");
const testPinKeypad = document.getElementById("testPinKeypad");
const testPinStatus = document.getElementById("testPinStatus");

function updateTestPinDisplay() {
  [...testPinDisplay.children].forEach((dot, index) => {
    dot.classList.toggle("filled", index < testPinInput.length);
  });
}

async function openTestBuild() {
  testPinStatus.textContent = "Loading test build…";
  try {
    const response = await fetch("../../index.html", { cache: "no-store" });
    if (!response.ok) throw new Error("Test build could not be loaded");
    let html = await response.text();
    html = html.replace("<head>", "<head><base href=\"../../\">");
    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    testPinStatus.textContent = "Test build could not be loaded.";
    console.error(error);
  }
}

testPinKeypad.addEventListener("click", event => {
  const key = event.target.closest("[data-pin-key]");
  const action = event.target.closest("[data-pin-action]");

  if (key) {
    if (testPinInput.length < TEST_PIN.length) {
      testPinInput += key.dataset.pinKey;
      updateTestPinDisplay();
    }

    if (testPinInput.length === TEST_PIN.length) {
      if (testPinInput === TEST_PIN) {
        openTestBuild();
      } else {
        testPinStatus.textContent = "Incorrect PIN";
        setTimeout(() => {
          testPinInput = "";
          updateTestPinDisplay();
          testPinStatus.textContent = "";
        }, 450);
      }
    }
    return;
  }

  if (action?.dataset.pinAction === "clear") {
    testPinInput = "";
    testPinStatus.textContent = "";
    updateTestPinDisplay();
  }

  if (action?.dataset.pinAction === "backspace") {
    testPinInput = testPinInput.slice(0, -1);
    testPinStatus.textContent = "";
    updateTestPinDisplay();
  }
});

updateTestPinDisplay();
