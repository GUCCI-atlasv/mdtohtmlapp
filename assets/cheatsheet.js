(function () {
  "use strict";

  var input = document.getElementById("playgroundInput");
  var preview = document.getElementById("playgroundPreview");
  var htmlOutput = document.getElementById("playgroundHtml");
  var toastTimer;

  function showToast(message) {
    var toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  function render() {
    var result = MDH.renderMarkdown(input.value);
    preview.innerHTML = result.html;
    htmlOutput.textContent = result.html;
  }

  function copyText(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(message);
      });
      return;
    }
    var helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    showToast(message);
  }

  input.addEventListener("input", render);

  document.addEventListener("click", function (event) {
    var copy = event.target.closest("[data-copy-target]");
    if (copy) {
      var target = document.getElementById(copy.dataset.copyTarget);
      var value = target && typeof target.value === "string" ? target.value : target ? target.textContent : "";
      copyText(value, "Copied");
      return;
    }

    var copyPreview = event.target.closest("[data-copy-preview]");
    if (copyPreview) {
      var previewTarget = document.getElementById(copyPreview.dataset.copyPreview);
      copyText(previewTarget ? previewTarget.innerText : "", "Preview text copied");
      return;
    }

    var tryButton = event.target.closest("[data-example]");
    if (tryButton) {
      input.value = window.CHEATSHEET_DATA.examples[tryButton.dataset.example] || "";
      render();
      document.getElementById("playground").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(function () { input.focus(); }, 350);
      return;
    }

    var troubleButton = event.target.closest("[data-trouble]");
    if (troubleButton) {
      input.value = window.CHEATSHEET_DATA.troubleshooting[Number(troubleButton.dataset.trouble)] || "";
      render();
      document.getElementById("playground").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(function () { input.focus(); }, 350);
    }
  });

  document.querySelectorAll("[data-converter-example]").forEach(function (link) {
    link.addEventListener("click", function () {
      var markdown = window.CHEATSHEET_DATA.examples[link.dataset.converterExample] || "";
      try { localStorage.setItem("mdh-draft", markdown); } catch (error) {}
    });
  });

  document.getElementById("modeToggle").addEventListener("click", function () {
    var root = document.documentElement;
    root.dataset.theme = root.dataset.theme === "dark" ? "" : "dark";
    try { localStorage.setItem("mdh-mode", root.dataset.theme || "light"); } catch (error) {}
  });

  try {
    if (localStorage.getItem("mdh-mode") === "dark") document.documentElement.dataset.theme = "dark";
  } catch (error) {}
})();
