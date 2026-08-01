(()=>{
  if(location.pathname==="/admin/"||document.getElementById("adminHomeButton"))return;
  const link=document.createElement("a");
  link.id="adminHomeButton";link.href="/admin/";link.textContent="ADMIN";link.setAttribute("aria-label","Back to Admin Panel");
  Object.assign(link.style,{position:"fixed",zIndex:"480",top:"max(8px, env(safe-area-inset-top))",left:"max(8px, env(safe-area-inset-left))",height:"28px",padding:"0 11px",display:"flex",alignItems:"center",border:"1px solid rgba(255,255,255,.25)",borderRadius:"9px",background:"rgba(5,6,5,.86)",backdropFilter:"blur(10px)",color:"#fff",font:"900 9px Arial,sans-serif",letterSpacing:".09em",textDecoration:"none",boxShadow:"0 5px 18px rgba(0,0,0,.3)"});
  document.body.append(link);
})();
