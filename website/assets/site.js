// Language toggle (EN <-> AR flips the whole page to RTL), copy button and playground.
(function () {
  const STORE = "ittijah-lang";
  const root = document.documentElement;

  function setLang(lang) {
    root.lang = lang;
    root.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-en]").forEach((el) => {
      const v = el.getAttribute(lang === "ar" ? "data-ar" : "data-en");
      if (v !== null) el.innerHTML = v;
    });
    try {
      localStorage.setItem(STORE, lang);
    } catch {
      /* private mode */
    }
  }
  let saved = null;
  try {
    saved = localStorage.getItem(STORE);
  } catch {
    /* ignore */
  }
  if (saved && saved !== root.lang) setLang(saved);
  document
    .querySelectorAll("[data-toggle-lang]")
    .forEach((b) => b.addEventListener("click", () => setLang(root.lang === "ar" ? "en" : "ar")));

  document.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => {
      navigator.clipboard?.writeText(b.getAttribute("data-copy"));
      const t = b.textContent;
      b.textContent = "✓";
      setTimeout(() => (b.textContent = t), 1200);
    }),
  );

  // ---------------- playground ----------------
  const input = document.getElementById("pg-input");
  if (!input || !window.IttijahPlayground) return;
  const leading = document.getElementById("pg-leading");
  const before = document.getElementById("pg-before");
  const after = document.getElementById("pg-after");
  const list = document.getElementById("pg-findings");
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

  function update() {
    const { findings, fixed } = window.IttijahPlayground.analyze(input.value, leading.checked);
    before.textContent = input.value;
    after.textContent = fixed;
    list.innerHTML = findings.length
      ? findings.map((f) => `<li><b>[${f.check}]</b> ${esc(f.message)}</li>`).join("")
      : `<li class="ok">✓ No bidi problems found.</li>`;
  }
  input.addEventListener("input", update);
  leading.addEventListener("change", update);
  document.querySelectorAll("[data-example]").forEach((b) =>
    b.addEventListener("click", () => {
      input.value = b.getAttribute("data-example");
      update();
    }),
  );
  update();
})();
