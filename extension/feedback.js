(function () {
  "use strict";

  var SUPPORT_EMAIL = "support@mdtohtml.app";
  var VERSION = "1.4.0";
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var pageTitle = (params.get("title") || "").slice(0, 200);
  var pageUrl = (params.get("url") || "").slice(0, 1200);

  function setStatus(message, error) {
    $("status").textContent = message || "";
    $("status").className = "status" + (error ? " error" : "");
  }

  function feedbackText() {
    var lines = [
      "反馈类型：" + $("category").value,
      "联系邮箱：" + ($("email").value.trim() || "未填写"),
      "插件版本：" + VERSION
    ];
    if ($("includePage").checked && (pageTitle || pageUrl)) {
      lines.push("页面标题：" + (pageTitle || "未获取"));
      lines.push("页面地址：" + (pageUrl || "未获取"));
    }
    lines.push("", "问题描述：", $("message").value.trim());
    return lines.join("\n");
  }

  function mailtoUrl() {
    var subject = "[mdtohtml Feedback] " + $("category").value;
    return "mailto:" + SUPPORT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(feedbackText());
  }

  function valid() {
    if (!$("feedbackForm").reportValidity()) return false;
    if ($("message").value.trim().length < 5) {
      setStatus("请至少填写 5 个字符的问题描述。", true);
      $("message").focus();
      return false;
    }
    return true;
  }

  if (pageTitle || pageUrl) {
    $("pageContext").hidden = false;
    $("contextTitle").textContent = pageTitle || "当前页面";
    $("contextUrl").textContent = pageUrl;
  } else {
    $("includePage").checked = false;
  }

  $("message").addEventListener("input", function () {
    $("counter").textContent = this.value.length + " / 3000";
    setStatus("");
  });

  $("feedbackForm").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!valid()) return;
    setStatus("已打开邮箱，请确认收件人为 " + SUPPORT_EMAIL + " 后发送。");
    location.href = mailtoUrl();
  });

  $("copyFeedback").addEventListener("click", async function () {
    if (!valid()) return;
    try {
      await navigator.clipboard.writeText("收件人：" + SUPPORT_EMAIL + "\n主题：[mdtohtml Feedback] " + $("category").value + "\n\n" + feedbackText());
      setStatus("反馈内容已复制，可手动发送至 " + SUPPORT_EMAIL + "。");
    } catch (_) {
      setStatus("复制失败，请手动发送邮件至 " + SUPPORT_EMAIL + "。", true);
    }
  });
})();
