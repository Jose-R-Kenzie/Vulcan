document.addEventListener("mousemove", (e) => {
  const light = document.querySelector(".mouse-light");
  if (!light) return;
  light.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});