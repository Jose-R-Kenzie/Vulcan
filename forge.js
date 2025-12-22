<script src="forge.js"></script>
// Mouse reactive forge lighting
document.addEventListener("mousemove", (e) => {
  const light = document.querySelector(".mouse-light");
  light.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});