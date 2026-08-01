(()=>{
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  const PIN="231189";
  const SESSION_KEY="tattooDiceAdminUnlocked";
  const gate=document.getElementById("panelPin");
  const panel=document.getElementById("adminPanel");
  const dots=[...document.querySelectorAll("#panelPinDots i")];
  const status=document.getElementById("panelPinStatus");
  let input="";
  const render=()=>dots.forEach((dot,index)=>dot.classList.toggle("on",index<input.length));
  const unlock=()=>{
    sessionStorage.setItem(SESSION_KEY,"true");
    document.body.classList.remove("panel-locked");gate.classList.add("hidden");panel.setAttribute("aria-hidden","false");
  };
  if(sessionStorage.getItem(SESSION_KEY)==="true"){unlock();return;}
  document.getElementById("panelPinGrid").addEventListener("click",event=>{
    const digit=event.target.closest("[data-pin]");const action=event.target.closest("[data-action]");
    if(digit&&input.length<PIN.length)input+=digit.dataset.pin;
    if(action?.dataset.action==="clear")input="";
    if(action?.dataset.action==="back")input=input.slice(0,-1);
    status.textContent="";render();
    if(input.length!==PIN.length)return;
    if(input===PIN){unlock();return;}
    status.textContent="Incorrect PIN";setTimeout(()=>{input="";render();status.textContent="";},500);
  });
})();
