/**
 * Fluency Standard Enrollment Funnel
 * Minimal vanilla JavaScript for client-side interactions only.
 * Zero external libraries, zero inline handlers, strict CSP compatible.
 */
(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     1. Program Whitelist Configuration
     BACKEND: Display metadata only. The server must always resolve the real
     fee from the submitted "program" plan ID.
     ------------------------------------------------------------------------ */
  var PROGRAMS = Object.freeze({
    standard: Object.freeze({
      id: "standard",
      name: "Standard",
      price: "[STANDARD_PRICE]"
    }),
    upgraded: Object.freeze({
      id: "upgraded",
      name: "Upgraded",
      price: "[UPGRADED_PRICE]"
    })
  });

  var MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
  var ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var BD_MOBILE_REGEX = /^(?:\+?880|0)1[3-9]\d{8}$/;

  /* ------------------------------------------------------------------------
     2. Page 1: Video Facade (Load player only on click)
     ------------------------------------------------------------------------ */
  function initVideoFacade() {
    var facade = document.querySelector("[data-video-facade]");
    if (!facade) {
      return;
    }

    var playBtn = facade.querySelector("[data-video-play]");
    if (!playBtn) {
      return;
    }

    playBtn.addEventListener("click", function () {
      var videoType = facade.getAttribute("data-video-type") || "mp4";
      var src = facade.getAttribute("data-video-src") || "";
      var captionsSrc = facade.getAttribute("data-captions-src") || "";
      var captionsLang = facade.getAttribute("data-captions-lang") || "en";
      var captionsLabel = facade.getAttribute("data-captions-label") || "English";
      var title = facade.getAttribute("data-video-title") || "Overview video";

      facade.textContent = "";

      if (videoType === "embed") {
        var iframe = document.createElement("iframe");
        iframe.className = "video-embed";
        iframe.src = src;
        iframe.title = title;
        iframe.width = "960";
        iframe.height = "540";
        iframe.allow = "autoplay; fullscreen; picture-in-picture";
        iframe.allowFullscreen = true;
        facade.appendChild(iframe);
        return;
      }

      var video = document.createElement("video");
      video.className = "video-player";
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.width = 960;
      video.height = 540;
      video.setAttribute("aria-label", title);

      var source = document.createElement("source");
      source.src = src;
      source.type = "video/mp4";
      video.appendChild(source);

      if (captionsSrc) {
        var track = document.createElement("track");
        track.kind = "captions";
        track.src = captionsSrc;
        track.srclang = captionsLang;
        track.label = captionsLabel;
        track.default = true;
        video.appendChild(track);
      }

      facade.appendChild(video);
      video.focus();
    });
  }

  /* ------------------------------------------------------------------------
     3. Page 3: Read & Whitelist ?program= Query Parameter
     ------------------------------------------------------------------------ */
  function resolveSelectedProgram() {
    var params = new URLSearchParams(window.location.search);
    var requested = (params.get("program") || "").trim().toLowerCase();

    if (Object.prototype.hasOwnProperty.call(PROGRAMS, requested)) {
      return PROGRAMS[requested];
    }

    return PROGRAMS.standard;
  }

  function applySelectedProgram(program) {
    var planNameEl = document.getElementById("summary-plan-name");
    var planPriceEl = document.getElementById("summary-plan-price");
    var paymentAmountEl = document.getElementById("payment-amount");
    var confirmedPlanEl = document.getElementById("confirmed-plan-name");
    var programInput = document.getElementById("program-input");

    if (planNameEl) {
      planNameEl.textContent = program.name;
    }
    if (planPriceEl) {
      planPriceEl.textContent = program.price;
    }
    if (paymentAmountEl) {
      paymentAmountEl.textContent = program.price;
    }
    if (confirmedPlanEl) {
      confirmedPlanEl.textContent = program.name;
    }
    if (programInput) {
      programInput.value = program.id;
    }
  }

  /* ------------------------------------------------------------------------
     4. Page 3: Copy Payment Number (Clipboard API + Fallback + Aria-Live)
     ------------------------------------------------------------------------ */
  function copyTextFallback(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.className = "sr-only";
    document.body.appendChild(textarea);
    textarea.select();

    var succeeded = false;
    try {
      succeeded = document.execCommand("copy");
    } catch (err) {
      succeeded = false;
    }

    document.body.removeChild(textarea);
    return succeeded;
  }

  function initCopyButton() {
    var copyBtn = document.getElementById("copy-number-btn");
    var copyStatus = document.getElementById("copy-status");
    if (!copyBtn) {
      return;
    }

    var targetId = copyBtn.getAttribute("data-copy-target");
    var targetEl = targetId ? document.getElementById(targetId) : null;
    var labelEl = copyBtn.querySelector(".copy-btn-label");
    var copyIcon = copyBtn.querySelector(".icon-copy");
    var checkIcon = copyBtn.querySelector(".icon-check");
    var revertTimer = null;

    function showCopiedFeedback() {
      if (revertTimer) {
        window.clearTimeout(revertTimer);
      }

      copyBtn.classList.add("is-copied");
      if (labelEl) {
        labelEl.textContent = "Copied";
      }
      if (copyIcon) {
        copyIcon.hidden = true;
      }
      if (checkIcon) {
        checkIcon.hidden = false;
      }
      if (copyStatus) {
        copyStatus.textContent = "Payment number copied to clipboard.";
      }

      revertTimer = window.setTimeout(function () {
        copyBtn.classList.remove("is-copied");
        if (labelEl) {
          labelEl.textContent = "Copy number";
        }
        if (copyIcon) {
          copyIcon.hidden = false;
        }
        if (checkIcon) {
          checkIcon.hidden = true;
        }
        if (copyStatus) {
          copyStatus.textContent = "";
        }
      }, 2000);
    }

    copyBtn.addEventListener("click", function () {
      if (!targetEl) {
        return;
      }

      var textToCopy = targetEl.textContent.trim();
      if (!textToCopy) {
        return;
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(textToCopy).then(
          function () {
            showCopiedFeedback();
          },
          function () {
            if (copyTextFallback(textToCopy)) {
              showCopiedFeedback();
            }
          }
        );
      } else if (copyTextFallback(textToCopy)) {
        showCopiedFeedback();
      }
    });
  }

  /* ------------------------------------------------------------------------
     5. Page 3: Enrollment Form Validation, Screenshot Upload & Submission
     ------------------------------------------------------------------------ */
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + " B";
    }
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    }
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function normalizeBangladeshMobile(rawValue) {
    return rawValue.replace(/[\s\-()]/g, "");
  }

  function initEnrollmentForm() {
    var form = document.getElementById("enroll-form");
    if (!form) {
      return;
    }

    var selectedProgram = resolveSelectedProgram();
    applySelectedProgram(selectedProgram);

    var submitBtn = document.getElementById("submit-btn");
    var submitLabel = submitBtn ? submitBtn.querySelector(".btn-label") : null;
    var formStatusError = document.getElementById("form-status-error");
    var confirmationCard = document.getElementById("enroll-confirmation");

    var fullNameInput = document.getElementById("full-name");
    var whatsappInput = document.getElementById("whatsapp");
    var emailInput = document.getElementById("email");
    var currentBandSelect = document.getElementById("current-band");
    var targetBandSelect = document.getElementById("target-band");
    var transactionIdInput = document.getElementById("transaction-id");

    var uploadZone = document.getElementById("upload-zone");
    var fileInput = document.getElementById("screenshot");
    var uploadPreview = document.getElementById("upload-preview");
    var uploadThumb = document.getElementById("upload-thumb");
    var uploadFilename = document.getElementById("upload-filename");
    var uploadFilesize = document.getElementById("upload-filesize");
    var removeFileBtn = document.getElementById("remove-file-btn");
    var screenshotError = document.getElementById("screenshot-error");

    var selectedFile = null;
    var previewObjectUrl = null;
    var isSubmitting = false;

    function setFieldError(inputEl, errorId, message) {
      var errorEl = document.getElementById(errorId);
      if (message) {
        inputEl.setAttribute("aria-invalid", "true");
        if (errorEl) {
          errorEl.textContent = message;
        }
      } else {
        inputEl.removeAttribute("aria-invalid");
        if (errorEl) {
          errorEl.textContent = "";
        }
      }
    }

    function validateField(inputEl, showErrors) {
      var id = inputEl.id;
      var value = (inputEl.value || "").trim();
      var message = "";

      if (id === "full-name") {
        if (!value) {
          message = "Enter your full name.";
        } else if (value.length < 2) {
          message = "Name must be at least 2 characters.";
        }
      } else if (id === "whatsapp") {
        var normalized = normalizeBangladeshMobile(value);
        if (!normalized) {
          message = "Enter your WhatsApp number.";
        } else if (!BD_MOBILE_REGEX.test(normalized)) {
          message = "Enter a valid Bangladesh mobile number (for example 017XXXXXXXX).";
        }
      } else if (id === "email") {
        if (!value) {
          message = "Enter your email address.";
        } else if (!inputEl.validity.valid) {
          message = "Enter a valid email address.";
        }
      } else if (id === "current-band") {
        if (!value) {
          message = "Select your current speaking band.";
        }
      } else if (id === "target-band") {
        if (!value) {
          message = "Select your target speaking band.";
        }
      } else if (id === "transaction-id") {
        if (!value) {
          message = "Enter the transaction ID from your receipt.";
        } else if (value.length < 4) {
          message = "Transaction ID looks too short.";
        }
      }

      if (showErrors) {
        setFieldError(inputEl, id + "-error", message);
      }

      return message === "";
    }

    var textFields = [
      fullNameInput,
      whatsappInput,
      emailInput,
      currentBandSelect,
      targetBandSelect,
      transactionIdInput
    ].filter(Boolean);

    function updateSubmitState() {
      if (!submitBtn) {
        return;
      }

      if (isSubmitting) {
        submitBtn.disabled = true;
        return;
      }

      var allFieldsValid = textFields.every(function (field) {
        return validateField(field, false);
      });

      submitBtn.disabled = !(allFieldsValid && selectedFile !== null);
    }

    textFields.forEach(function (field) {
      field.addEventListener("blur", function () {
        validateField(field, true);
        updateSubmitState();
      });

      field.addEventListener("input", function () {
        if (field.getAttribute("aria-invalid") === "true") {
          validateField(field, true);
        }
        updateSubmitState();
      });

      field.addEventListener("change", function () {
        validateField(field, true);
        updateSubmitState();
      });
    });

    /* Screenshot Upload Handling */
    function clearSelectedFile(clearError) {
      selectedFile = null;
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }
      if (fileInput) {
        fileInput.value = "";
      }
      if (uploadPreview) {
        uploadPreview.hidden = true;
      }
      if (uploadZone) {
        uploadZone.hidden = false;
        if (clearError) {
          uploadZone.classList.remove("has-error");
        }
      }
      if (clearError && screenshotError) {
        screenshotError.textContent = "";
      }
      updateSubmitState();
    }

    function handleFileSelection(file) {
      if (!file) {
        return;
      }

      if (ALLOWED_MIME_TYPES.indexOf(file.type) === -1) {
        clearSelectedFile(false);
        if (uploadZone) {
          uploadZone.classList.add("has-error");
        }
        if (screenshotError) {
          screenshotError.textContent = "Please upload a JPG, PNG, or WEBP image.";
        }
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        clearSelectedFile(false);
        if (uploadZone) {
          uploadZone.classList.add("has-error");
        }
        if (screenshotError) {
          screenshotError.textContent = "File is larger than 5MB. Please upload a smaller screenshot.";
        }
        return;
      }

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }

      selectedFile = file;
      previewObjectUrl = URL.createObjectURL(file);

      if (uploadZone) {
        uploadZone.classList.remove("has-error");
        uploadZone.hidden = true;
      }
      if (screenshotError) {
        screenshotError.textContent = "";
      }
      if (uploadThumb) {
        uploadThumb.src = previewObjectUrl;
      }
      if (uploadFilename) {
        uploadFilename.textContent = file.name;
      }
      if (uploadFilesize) {
        uploadFilesize.textContent = formatFileSize(file.size);
      }
      if (uploadPreview) {
        uploadPreview.hidden = false;
      }

      updateSubmitState();
    }

    if (uploadZone && fileInput) {
      uploadZone.addEventListener("click", function () {
        fileInput.click();
      });

      uploadZone.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          fileInput.click();
        }
      });

      ["dragenter", "dragover"].forEach(function (eventName) {
        uploadZone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          uploadZone.classList.add("is-dragover");
        });
      });

      ["dragleave", "drop"].forEach(function (eventName) {
        uploadZone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          uploadZone.classList.remove("is-dragover");
        });
      });

      uploadZone.addEventListener("drop", function (event) {
        var files = event.dataTransfer ? event.dataTransfer.files : null;
        if (files && files.length > 0) {
          /* Sync dropped file into the file input when DataTransfer is supported */
          if (typeof DataTransfer !== "undefined") {
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            fileInput.files = dt.files;
          }
          handleFileSelection(files[0]);
        }
      });

      fileInput.addEventListener("change", function () {
        if (fileInput.files && fileInput.files.length > 0) {
          handleFileSelection(fileInput.files[0]);
        }
      });
    }

    if (removeFileBtn) {
      removeFileBtn.addEventListener("click", function () {
        clearSelectedFile(true);
        if (uploadZone) {
          uploadZone.focus();
        }
      });
    }

    /* Form Submission */
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      var firstInvalid = null;
      textFields.forEach(function (field) {
        var valid = validateField(field, true);
        if (!valid && !firstInvalid) {
          firstInvalid = field;
        }
      });

      if (!selectedFile) {
        if (uploadZone) {
          uploadZone.classList.add("has-error");
        }
        if (screenshotError) {
          screenshotError.textContent = "Please attach your payment screenshot.";
        }
        if (!firstInvalid && uploadZone) {
          firstInvalid = uploadZone;
        }
      }

      if (firstInvalid) {
        firstInvalid.focus();
        updateSubmitState();
        return;
      }

      isSubmitting = true;
      if (formStatusError) {
        formStatusError.textContent = "";
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("is-loading");
      }
      if (submitLabel) {
        submitLabel.textContent = "Submitting...";
      }

      /*
       * TODO / BACKEND: Replace the simulated delay below with a real POST request:
       *
       * var formData = new FormData(form);
       * if (selectedFile) {
       *   formData.set("screenshot", selectedFile, selectedFile.name);
       * }
       * fetch(form.action, {
       *   method: "POST",
       *   body: formData,
       *   credentials: "same-origin"
       * })
       *   .then(function (response) {
       *     if (!response.ok) {
       *       throw new Error("Submission failed");
       *     }
       *     return response.json();
       *   })
       *   .then(showConfirmationState)
       *   .catch(handleSubmissionError);
       */
      window.setTimeout(function () {
        isSubmitting = false;
        form.hidden = true;

        var enrollIntro = document.querySelector(".enroll-intro");
        var summaryStrip = document.querySelector(".summary-strip");
        if (enrollIntro) {
          enrollIntro.hidden = true;
        }
        if (summaryStrip) {
          summaryStrip.hidden = true;
        }

        if (confirmationCard) {
          confirmationCard.hidden = false;
          confirmationCard.focus();
          confirmationCard.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 900);
    });

    updateSubmitState();
  }

  /* ------------------------------------------------------------------------
     6. Bootstrap
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    initVideoFacade();
    initCopyButton();
    initEnrollmentForm();
  });
})();