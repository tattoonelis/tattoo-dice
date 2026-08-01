(() => {
  const ACCESS_PIN = "231189";
  const gate = document.getElementById("generatorPinGate");
  const display = document.getElementById("generatorPinDisplay");
  const keypad = document.getElementById("generatorPinKeypad");
  const status = document.getElementById("generatorPinStatus");
  let input = "";

  const render = () => {
    [...display.children].forEach((dot, index) => {
      dot.classList.toggle("filled", index < input.length);
    });
  };

  const unlock = () => {
    sessionStorage.setItem("tattooDiceAdminUnlocked","true");
    document.body.classList.remove("generator-access-locked");
    gate.classList.add("is-unlocked");
    gate.setAttribute("aria-hidden", "true");
    setTimeout(() => gate.remove(), 240);
  };

  if(sessionStorage.getItem("tattooDiceAdminUnlocked")==="true"){
    unlock();
    return;
  }

  keypad.addEventListener("pointerup", event => {
    const digit = event.target.closest("[data-generator-pin-key]");
    const action = event.target.closest("[data-generator-pin-action]");
    if (!digit && !action) return;

    status.textContent = "";

    if (digit && input.length < ACCESS_PIN.length) {
      input += digit.dataset.generatorPinKey;
    } else if (action?.dataset.generatorPinAction === "clear") {
      input = "";
    } else if (action?.dataset.generatorPinAction === "backspace") {
      input = input.slice(0, -1);
    }

    render();

    if (input.length !== ACCESS_PIN.length) return;
    if (input === ACCESS_PIN) {
      unlock();
      return;
    }

    status.textContent = "Incorrect PIN";
    input = "";
    setTimeout(render, 220);
  });

  render();
})();
