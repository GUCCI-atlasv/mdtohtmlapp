(function () {
  "use strict";

  var SUPPORT_EMAIL = "support@mdtohtml.app";
  var $ = function (id) { return document.getElementById(id); };

  function setStatus(message, error) {
    $("status").textContent = message || "";
    $("status").className = "feedback-status" + (error ? " error" : "");
  }

  function feedbackText() {
    var lines = [
      "Product: " + $("product").value,
      "Feedback type: " + $("category").value,
      "Contact email: " + ($("email").value.trim() || "Not provided"),
      "Related page: " + ($("pageUrl").value.trim() || "Not provided")
    ];
    if ($("includeBrowser").checked) {
      lines.push("Browser: " + navigator.userAgent);
    }
    lines.push("", "Message:", $("message").value.trim());
    return lines.join("\n");
  }

  function subject() {
    return "[mdtohtml Feedback] " + $("product").value + " — " + $("category").value;
  }

  function valid() {
    if (!$("feedbackForm").reportValidity()) return false;
    if ($("message").value.trim().length < 5) {
      setStatus("Please enter at least 5 characters.", true);
      $("message").focus();
      return false;
    }
    return true;
  }

  var params = new URLSearchParams(location.search);
  if (params.get("product") === "extension") $("product").value = "Browser Extension";
  if (params.get("url")) $("pageUrl").value = params.get("url").slice(0, 1200);

  $("message").addEventListener("input", function () {
    $("counter").textContent = this.value.length + " / 3000";
    setStatus("");
  });

  $("feedbackForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!valid()) return;
    setStatus("Your email app has been opened. Review the message, then send it to " + SUPPORT_EMAIL + ".");
    location.href = "mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent(subject()) + "&body=" + encodeURIComponent(feedbackText());
  });

  $("copyFeedback").addEventListener("click", async function () {
    if (!valid()) return;
    try {
      await navigator.clipboard.writeText("To: " + SUPPORT_EMAIL + "\nSubject: " + subject() + "\n\n" + feedbackText());
      setStatus("Feedback copied. You can email it to " + SUPPORT_EMAIL + ".");
    } catch (_) {
      setStatus("Copy failed. Please email " + SUPPORT_EMAIL + " directly.", true);
    }
  });
})();
