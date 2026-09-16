(function () {
  "use strict";

  const CFG = window.QI_CONFIG;
  const CURRENCY_FMT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  const state = {
    items: [],
    logoDataUrl: null,
  };

  let itemSeq = 0;

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    bizName: $("biz-name"), bizEmail: $("biz-email"), bizAddress: $("biz-address"), bizLogo: $("biz-logo"),
    clientName: $("client-name"), clientEmail: $("client-email"), clientAddress: $("client-address"),
    invNumber: $("inv-number"), invDate: $("inv-date"), invDue: $("inv-due"),
    itemsBody: $("items-body"), addItem: $("add-item"),
    taxRate: $("tax-rate"), discount: $("discount"), notes: $("notes"),
    saveInvoice: $("save-invoice"), downloadPdf: $("download-pdf"),
    savedList: $("saved-list"), savedCountHint: $("saved-count-hint"),
    proBadge: $("pro-badge"), upgradeBtn: $("upgrade-btn"),
    modal: $("upgrade-modal"), closeModal: $("close-modal"), buyLink: $("buy-link"),
    licenseInput: $("license-input"), activateBtn: $("activate-btn"), licenseStatus: $("license-status"),
    previewLogo: $("preview-logo"), previewBizName: $("preview-biz-name"),
    previewBizAddress: $("preview-biz-address"), previewBizEmail: $("preview-biz-email"),
    previewNumber: $("preview-number"), previewDate: $("preview-date"), previewDue: $("preview-due"),
    previewClientName: $("preview-client-name"), previewClientAddress: $("preview-client-address"),
    previewClientEmail: $("preview-client-email"), previewItems: $("preview-items"),
    previewSubtotal: $("preview-subtotal"), previewDiscount: $("preview-discount"),
    previewTax: $("preview-tax"), previewTotal: $("preview-total"), previewNotes: $("preview-notes"),
    previewWatermark: $("preview-watermark"),
  };

  // ---------- License / Pro state ----------
  function getLicense() {
    try {
      return JSON.parse(localStorage.getItem("qi_license") || "null");
    } catch {
      return null;
    }
  }
  function setLicense(data) {
    localStorage.setItem("qi_license", JSON.stringify(data));
  }
  function isPro() {
    const lic = getLicense();
    return !!(lic && lic.valid);
  }

  async function verifyLicense(key) {
    if (!key || !key.trim()) return { ok: false, message: "Enter a license key." };

    if (key.trim() === CFG.DEV_UNLOCK_CODE) {
      setLicense({ valid: true, key: "dev-unlock", verifiedAt: Date.now() });
      return { ok: true, message: "Dev unlock activated." };
    }

    try {
      const resp = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_permalink: CFG.GUMROAD_PRODUCT_PERMALINK,
          license_key: key.trim(),
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setLicense({ valid: true, key: key.trim(), verifiedAt: Date.now() });
        return { ok: true, message: "Pro unlocked. Thank you!" };
      }
      return { ok: false, message: data.message || "That license key wasn't recognized." };
    } catch (err) {
      return { ok: false, message: "Couldn't reach the license server. Check your connection and try again." };
    }
  }

  function refreshProUI() {
    const pro = isPro();
    els.proBadge.classList.toggle("hidden", !pro);
    els.upgradeBtn.classList.toggle("hidden", pro);
    els.previewWatermark.classList.toggle("hidden", pro);
    renderSavedList();
  }

  // ---------- Line items ----------
  function addItem(item) {
    const id = ++itemSeq;
    state.items.push({ id, description: item?.description || "", qty: item?.qty ?? 1, rate: item?.rate ?? 0 });
    renderItems();
  }

  function removeItem(id) {
    state.items = state.items.filter((i) => i.id !== id);
    if (state.items.length === 0) addItem();
    else renderItems();
  }

  function renderItems() {
    els.itemsBody.innerHTML = "";
    for (const item of state.items) {
      const row = document.createElement("div");
      row.className = "items-row";
      row.dataset.id = item.id;
      row.innerHTML = `
        <input type="text" class="f-desc" placeholder="Design consultation" value="${escapeAttr(item.description)}" />
        <input type="number" class="f-qty" min="0" step="0.01" value="${item.qty}" />
        <input type="number" class="f-rate" min="0" step="0.01" value="${item.rate}" />
        <span class="f-amount">${CURRENCY_FMT.format(item.qty * item.rate)}</span>
        <button class="remove-item" title="Remove" type="button">&times;</button>
      `;
      row.querySelector(".f-desc").addEventListener("input", (e) => {
        item.description = e.target.value;
        updatePreview();
      });
      row.querySelector(".f-qty").addEventListener("input", (e) => {
        item.qty = parseFloat(e.target.value) || 0;
        row.querySelector(".f-amount").textContent = CURRENCY_FMT.format(item.qty * item.rate);
        updatePreview();
      });
      row.querySelector(".f-rate").addEventListener("input", (e) => {
        item.rate = parseFloat(e.target.value) || 0;
        row.querySelector(".f-amount").textContent = CURRENCY_FMT.format(item.qty * item.rate);
        updatePreview();
      });
      row.querySelector(".remove-item").addEventListener("click", () => removeItem(item.id));
      els.itemsBody.appendChild(row);
    }
    updatePreview();
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function computeTotals() {
    const subtotal = state.items.reduce((sum, i) => sum + i.qty * i.rate, 0);
    const discount = parseFloat(els.discount.value) || 0;
    const taxRate = parseFloat(els.taxRate.value) || 0;
    const taxable = Math.max(subtotal - discount, 0);
    const tax = taxable * (taxRate / 100);
    const total = taxable + tax;
    return { subtotal, discount, tax, total };
  }

  // ---------- Preview ----------
  function updatePreview() {
    els.previewBizName.textContent = els.bizName.value || "Your Business";
    els.previewBizAddress.textContent = els.bizAddress.value;
    els.previewBizEmail.textContent = els.bizEmail.value;

    els.previewNumber.textContent = els.invNumber.value || "—";
    els.previewDate.textContent = formatDate(els.invDate.value);
    els.previewDue.textContent = formatDate(els.invDue.value);

    els.previewClientName.textContent = els.clientName.value || "—";
    els.previewClientAddress.textContent = els.clientAddress.value;
    els.previewClientEmail.textContent = els.clientEmail.value;

    els.previewItems.innerHTML = state.items
      .map(
        (i) => `<tr>
          <td>${escapeHtml(i.description || "—")}</td>
          <td>${i.qty}</td>
          <td>${CURRENCY_FMT.format(i.rate)}</td>
          <td>${CURRENCY_FMT.format(i.qty * i.rate)}</td>
        </tr>`
      )
      .join("");

    const { subtotal, discount, tax, total } = computeTotals();
    els.previewSubtotal.textContent = CURRENCY_FMT.format(subtotal);
    els.previewDiscount.textContent = "-" + CURRENCY_FMT.format(discount);
    els.previewTax.textContent = CURRENCY_FMT.format(tax);
    els.previewTotal.textContent = CURRENCY_FMT.format(total);

    els.previewNotes.textContent = els.notes.value;

    if (state.logoDataUrl && isPro()) {
      els.previewLogo.src = state.logoDataUrl;
      els.previewLogo.classList.remove("hidden");
    } else {
      els.previewLogo.classList.add("hidden");
    }
  }

  function formatDate(value) {
    if (!value) return "—";
    const d = new Date(value + "T00:00:00");
    if (isNaN(d)) return value;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  // ---------- Save / load invoices ----------
  function loadSavedInvoices() {
    try {
      return JSON.parse(localStorage.getItem("qi_invoices") || "[]");
    } catch {
      return [];
    }
  }
  function persistSavedInvoices(list) {
    localStorage.setItem("qi_invoices", JSON.stringify(list));
  }

  function snapshotInvoice() {
    return {
      biz: { name: els.bizName.value, email: els.bizEmail.value, address: els.bizAddress.value },
      client: { name: els.clientName.value, email: els.clientEmail.value, address: els.clientAddress.value },
      number: els.invNumber.value,
      date: els.invDate.value,
      due: els.invDue.value,
      items: state.items.map(({ description, qty, rate }) => ({ description, qty, rate })),
      taxRate: els.taxRate.value,
      discount: els.discount.value,
      notes: els.notes.value,
      logoDataUrl: isPro() ? state.logoDataUrl : null,
    };
  }

  function applyInvoice(inv) {
    els.bizName.value = inv.biz?.name || "";
    els.bizEmail.value = inv.biz?.email || "";
    els.bizAddress.value = inv.biz?.address || "";
    els.clientName.value = inv.client?.name || "";
    els.clientEmail.value = inv.client?.email || "";
    els.clientAddress.value = inv.client?.address || "";
    els.invNumber.value = inv.number || "";
    els.invDate.value = inv.date || "";
    els.invDue.value = inv.due || "";
    els.taxRate.value = inv.taxRate || 0;
    els.discount.value = inv.discount || 0;
    els.notes.value = inv.notes || "";
    state.items = [];
    itemSeq = 0;
    (inv.items && inv.items.length ? inv.items : [{}]).forEach(addItem);
    state.logoDataUrl = inv.logoDataUrl || null;
    updatePreview();
  }

  function saveCurrentInvoice() {
    const list = loadSavedInvoices();
    const snap = snapshotInvoice();
    const number = snap.number.trim();
    const existingIdx = number ? list.findIndex((i) => i.number === number) : -1;

    if (existingIdx === -1 && !isPro() && list.length >= CFG.FREE_INVOICE_LIMIT) {
      openModal();
      els.licenseStatus.textContent = `Free plan is limited to ${CFG.FREE_INVOICE_LIMIT} saved invoices. Unlock Pro to save more.`;
      els.licenseStatus.className = "license-status err";
      return;
    }

    const record = { ...snap, id: existingIdx >= 0 ? list[existingIdx].id : `inv_${Date.now()}`, savedAt: Date.now() };
    if (existingIdx >= 0) list[existingIdx] = record;
    else list.push(record);
    persistSavedInvoices(list);
    renderSavedList();
  }

  function renderSavedList() {
    const list = loadSavedInvoices();
    els.savedCountHint.textContent = isPro() ? `(${list.length})` : `(${list.length}/${CFG.FREE_INVOICE_LIMIT} free)`;
    if (list.length === 0) {
      els.savedList.innerHTML = `<div class="empty-hint">No saved invoices yet.</div>`;
      return;
    }
    els.savedList.innerHTML = "";
    list
      .slice()
      .sort((a, b) => b.savedAt - a.savedAt)
      .forEach((inv) => {
        const row = document.createElement("div");
        row.className = "saved-item";
        row.innerHTML = `
          <span>${escapeHtml(inv.number || "Untitled")} — ${escapeHtml(inv.client?.name || "No client")}</span>
          <span class="saved-item-actions">
            <button class="load" type="button">Load</button>
            <button class="delete" type="button">Delete</button>
          </span>
        `;
        row.querySelector(".load").addEventListener("click", () => applyInvoice(inv));
        row.querySelector(".delete").addEventListener("click", () => {
          persistSavedInvoices(loadSavedInvoices().filter((i) => i.id !== inv.id));
          renderSavedList();
        });
        els.savedList.appendChild(row);
      });
  }

  // ---------- PDF export ----------
  function downloadPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const marginX = 48;
    let y = 56;

    if (state.logoDataUrl && isPro()) {
      try {
        doc.addImage(state.logoDataUrl, "PNG", marginX, y - 20, 90, 36, undefined, "FAST");
      } catch {
        /* unsupported image format for this render, skip silently */
      }
    }

    doc.setFontSize(18);
    doc.text("INVOICE", 564, y, { align: "right" });

    doc.setFontSize(10);
    doc.setTextColor(90);
    y += 28;
    doc.text(els.bizName.value || "Your Business", marginX, y);
    doc.text(`No. ${els.invNumber.value || "—"}`, 564, y, { align: "right" });
    y += 14;
    wrapText(doc, els.bizAddress.value, marginX, y, 220);
    doc.text(`Date: ${formatDate(els.invDate.value)}`, 564, y, { align: "right" });
    y += 14;
    doc.text(els.bizEmail.value || "", marginX, y);
    doc.text(`Due: ${formatDate(els.invDue.value)}`, 564, y, { align: "right" });

    y += 34;
    doc.setTextColor(30);
    doc.setFontSize(9);
    doc.text("BILL TO", marginX, y);
    y += 14;
    doc.setFontSize(11);
    doc.text(els.clientName.value || "—", marginX, y);
    y += 14;
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(els.clientAddress.value || "", marginX, y);
    y += 14;
    doc.text(els.clientEmail.value || "", marginX, y);

    y += 30;
    const colX = { desc: marginX, qty: 340, rate: 410, amount: 500 };
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("DESCRIPTION", colX.desc, y);
    doc.text("QTY", colX.qty, y);
    doc.text("RATE", colX.rate, y);
    doc.text("AMOUNT", colX.amount, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(marginX, y, 564, y);
    y += 16;

    doc.setFontSize(10);
    doc.setTextColor(30);
    for (const item of state.items) {
      doc.text(String(item.description || "—"), colX.desc, y, { maxWidth: 270 });
      doc.text(String(item.qty), colX.qty, y);
      doc.text(CURRENCY_FMT.format(item.rate), colX.rate, y);
      doc.text(CURRENCY_FMT.format(item.qty * item.rate), colX.amount, y);
      y += 20;
    }

    y += 10;
    doc.setDrawColor(220);
    doc.line(360, y, 564, y);
    y += 18;

    const { subtotal, discount, tax, total } = computeTotals();
    const totalsLine = (label, value, bold) => {
      if (bold) { doc.setFontSize(12); doc.setTextColor(20); } else { doc.setFontSize(10); doc.setTextColor(90); }
      doc.text(label, 420, y);
      doc.text(value, 564, y, { align: "right" });
      y += bold ? 20 : 16;
    };
    totalsLine("Subtotal", CURRENCY_FMT.format(subtotal));
    totalsLine("Discount", "-" + CURRENCY_FMT.format(discount));
    totalsLine("Tax", CURRENCY_FMT.format(tax));
    totalsLine("Total", CURRENCY_FMT.format(total), true);

    if (els.notes.value) {
      y += 20;
      doc.setFontSize(9);
      doc.setTextColor(110);
      wrapText(doc, els.notes.value, marginX, y, 500);
    }

    if (!isPro()) {
      doc.setFontSize(8);
      doc.setTextColor(180);
      doc.text("Made with QuickInvoice — quickinvoice.app", marginX, 760);
    }

    doc.save(`${els.invNumber.value || "invoice"}.pdf`);
  }

  function wrapText(doc, text, x, y, maxWidth) {
    if (!text) return;
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
  }

  // ---------- Modal ----------
  function openModal() {
    els.modal.classList.remove("hidden");
    els.licenseStatus.textContent = "";
    els.licenseStatus.className = "license-status";
  }
  function closeModal() {
    els.modal.classList.add("hidden");
  }

  // ---------- Wiring ----------
  function init() {
    els.buyLink.href = CFG.GUMROAD_PRODUCT_URL;
    els.upgradeBtn.addEventListener("click", openModal);
    els.closeModal.addEventListener("click", closeModal);
    els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });

    els.activateBtn.addEventListener("click", async () => {
      els.activateBtn.disabled = true;
      els.licenseStatus.textContent = "Checking…";
      els.licenseStatus.className = "license-status";
      const result = await verifyLicense(els.licenseInput.value);
      els.licenseStatus.textContent = result.message;
      els.licenseStatus.className = "license-status " + (result.ok ? "ok" : "err");
      els.activateBtn.disabled = false;
      if (result.ok) {
        refreshProUI();
        setTimeout(closeModal, 1200);
      }
    });

    els.bizLogo.addEventListener("change", (e) => {
      if (!isPro()) {
        openModal();
        els.licenseStatus.textContent = "Logo upload is a Pro feature.";
        els.licenseStatus.className = "license-status err";
        e.target.value = "";
        return;
      }
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        state.logoDataUrl = reader.result;
        updatePreview();
      };
      reader.readAsDataURL(file);
    });

    [els.bizName, els.bizEmail, els.bizAddress, els.clientName, els.clientEmail, els.clientAddress,
      els.invNumber, els.invDate, els.invDue, els.taxRate, els.discount, els.notes].forEach((el) =>
      el.addEventListener("input", updatePreview)
    );

    els.addItem.addEventListener("click", () => addItem());
    els.saveInvoice.addEventListener("click", saveCurrentInvoice);
    els.downloadPdf.addEventListener("click", downloadPdf);

    const today = new Date().toISOString().slice(0, 10);
    els.invDate.value = today;
    els.invNumber.value = "INV-0001";

    addItem({ description: "", qty: 1, rate: 0 });
    refreshProUI();
    updatePreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
