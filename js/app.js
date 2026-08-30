(function () {
  var PAGE_SIZE = 5;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var state = {
    caseId: "",
    today: "2026-08-16",
    items: [],
    returnedIds: [],
    search: "",
    statusFilter: "all",
    page: 1,
    view: "dashboard",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function formatPrettyDate(iso) {
    if (!iso) return "—";
    var parts = iso.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    return MONTHS[m - 1] + " " + d + ", " + y;
  }

  function snapshot() {
    return P02.analyze(state.items, state.today, state.returnedIds);
  }

  function allCases() {
    return (window.P02_DATA && window.P02_DATA.cases) || [];
  }

  function findCase(id) {
    var list = allCases();
    for (var i = 0; i < list.length; i++) {
      if (list[i].case_id === id) return list[i];
    }
    return null;
  }

  function cloneItems(items) {
    return (items || []).map(function (item) {
      return {
        id: item.id,
        name: item.name,
        company: item.company || "",
        batch: item.batch,
        quantity: Number(item.quantity),
        unit_price_bdt: String(item.unit_price_bdt),
        expiry: item.expiry,
      };
    });
  }

  function applyCase(caseObj) {
    if (!caseObj) return snapshot();
    state.caseId = caseObj.case_id || "";
    state.today = caseObj.today;
    state.items = cloneItems(caseObj.items);
    state.returnedIds = (caseObj.mark_returned || []).slice();
    state.search = "";
    state.statusFilter = "all";
    state.page = 1;
    var search = $("search-input");
    var filter = $("status-filter");
    if (search) search.value = "";
    if (filter) filter.value = "all";
    render();
    return snapshot();
  }

  function getSnapshot() {
    return snapshot();
  }

  function markReturned(id) {
    if (state.returnedIds.indexOf(id) === -1) {
      state.returnedIds.push(id);
      render();
    }
  }

  function statusMeta(bucket) {
    if (bucket === "expired") return { text: "Expired", cls: "pill-expired" };
    if (bucket === "expiring_30") return { text: "Expiring Soon", cls: "pill-soon" };
    if (bucket === "expiring_90") return { text: "Within 90 days", cls: "pill-90" };
    if (bucket === "returned") return { text: "Returned", cls: "pill-returned" };
    return { text: "Safe", cls: "pill-safe" };
  }

  function expiryClass(bucket) {
    if (bucket === "expired") return "expiry-danger";
    if (bucket === "expiring_30") return "expiry-warn";
    return "";
  }

  function activeRows(data) {
    return data.classified.filter(function (row) {
      return !row.returned;
    });
  }

  function filteredRows(data) {
    var q = state.search.trim().toLowerCase();
    return activeRows(data).filter(function (row) {
      if (state.statusFilter === "urgent") {
        if (row.bucket !== "expired" && row.bucket !== "expiring_30") return false;
      } else if (state.statusFilter !== "all" && row.bucket !== state.statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.name.toLowerCase().indexOf(q) !== -1 ||
        row.batch.toLowerCase().indexOf(q) !== -1 ||
        row.company.toLowerCase().indexOf(q) !== -1 ||
        row.id.toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function setText(id, text, value) {
    var el = $(id);
    if (!el) return;
    el.textContent = text;
    if (value != null) el.setAttribute("data-value", value);
  }

  function renderUrgent(data) {
    var list = $("urgent-list");
    var banner = $("urgent-banner");
    var expired = data.groups.expired.slice().sort(function (a, b) {
      return a.daysLeft - b.daysLeft;
    });
    var soon = data.groups.expiring_30.slice().sort(function (a, b) {
      return a.daysLeft - b.daysLeft;
    });
    var bits = [];
    if (expired[0]) {
      var d = Math.abs(expired[0].daysLeft);
      bits.push(
        expired[0].name +
          " - " +
          expired[0].quantity +
          " units " +
          (d === 0 ? "expired today" : "expired " + d + " day" + (d === 1 ? "" : "s") + " ago")
      );
    }
    if (soon[0]) {
      bits.push(
        soon[0].name +
          " - " +
          soon[0].quantity +
          " units expiring in " +
          soon[0].daysLeft +
          " day" +
          (soon[0].daysLeft === 1 ? "" : "s")
      );
    }
    list.innerHTML = bits
      .map(function (line) {
        return "<li>" + escapeHtml(line) + "</li>";
      })
      .join("");
    banner.style.display = bits.length ? "flex" : "none";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rowHtml(row, withActions, withTestids) {
    var meta = statusMeta(row.bucket);
    var returnTest = withTestids
      ? ' data-testid="btn-return-' + escapeHtml(row.id) + '"'
      : "";
    var rowTest = withTestids
      ? ' data-testid="item-row-' + escapeHtml(row.id) + '"'
      : "";
    var action =
      withActions && !row.returned
        ? '<div class="actions">' +
          '<button class="ghost btn-view" data-id="' +
          escapeHtml(row.id) +
          '" title="View" type="button" aria-label="View">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
          '<path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12Z" stroke="currentColor" stroke-width="1.7"/>' +
          '<circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>' +
          "</svg></button>" +
          '<button class="btn-return"' +
          returnTest +
          ' data-id="' +
          escapeHtml(row.id) +
          '" type="button">Return</button>' +
          "</div>"
        : "";
    return (
      "<tr" +
      rowTest +
      ' data-bucket="' +
      row.bucket +
      '">' +
      '<td><div class="med-name">' +
      escapeHtml(row.name) +
      '</div><div class="med-sub">' +
      escapeHtml(row.company) +
      "</div></td>" +
      "<td>" +
      escapeHtml(row.batch) +
      "</td>" +
      '<td class="qty">' +
      row.quantity.toLocaleString("en-US") +
      "</td>" +
      '<td class="' +
      expiryClass(row.bucket) +
      '">' +
      formatPrettyDate(row.expiry) +
      "</td>" +
      '<td><span class="pill ' +
      meta.cls +
      '">' +
      meta.text +
      "</span></td>" +
      (withActions ? "<td>" + action + "</td>" : "") +
      "</tr>"
    );
  }

  function bindRowActions(root) {
    root.querySelectorAll(".btn-return").forEach(function (btn) {
      btn.addEventListener("click", function () {
        markReturned(btn.getAttribute("data-id"));
      });
    });
    root.querySelectorAll(".btn-view").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showDetail(btn.getAttribute("data-id"));
      });
    });
  }

  function renderRegistry(data) {
    var rows = filteredRows(data);
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PAGE_SIZE;
    var visibleIds = {};
    rows.slice(start, start + PAGE_SIZE).forEach(function (row) {
      visibleIds[row.id] = true;
    });

    var body = $("registry-body");
    body.innerHTML = rows
      .map(function (row) {
        var html = rowHtml(row, true, true);
        if (!visibleIds[row.id]) {
          html = html.replace("<tr ", '<tr class="is-hidden-row" ');
        }
        return html;
      })
      .join("");
    bindRowActions(body);

    var from = total === 0 ? 0 : start + 1;
    var to = Math.min(start + PAGE_SIZE, total);
    $("page-info").textContent = "Showing " + from + "-" + to + " of " + total;

    var nums = $("page-nums");
    nums.innerHTML = "";
    for (var i = 1; i <= pages && i <= 6; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "page-num" + (i === state.page ? " is-active" : "");
      b.textContent = String(i);
      b.setAttribute("data-page", String(i));
      nums.appendChild(b);
    }
    $("page-prev").disabled = state.page <= 1;
    $("page-next").disabled = state.page >= pages;
  }

  function renderInventory(data) {
    var inv = $("inventory-body");
    inv.innerHTML = activeRows(data)
      .map(function (row) {
        return rowHtml(row, true, false);
      })
      .join("");
    bindRowActions(inv);

    var ret = $("returned-body");
    if (!data.groups.returned.length) {
      ret.innerHTML =
        '<tr><td colspan="5" style="color:#6b7280">No lots have been returned to the distributor.</td></tr>';
    } else {
      ret.innerHTML = data.groups.returned
        .map(function (row) {
          return rowHtml(row, false, true);
        })
        .join("");
    }
  }

  function showDetail(id) {
    var data = snapshot();
    var row = null;
    data.classified.forEach(function (item) {
      if (item.id === id) row = item;
    });
    if (!row) return;
    $("detail-title").textContent = row.name;
    $("detail-body").innerHTML =
      "<dt>ID</dt><dd>" +
      escapeHtml(row.id) +
      "</dd>" +
      "<dt>Company</dt><dd>" +
      escapeHtml(row.company) +
      "</dd>" +
      "<dt>Batch</dt><dd>" +
      escapeHtml(row.batch) +
      "</dd>" +
      "<dt>Quantity</dt><dd>" +
      row.quantity +
      "</dd>" +
      "<dt>Unit price</dt><dd>৳" +
      escapeHtml(String(row.unit_price_bdt)) +
      "</dd>" +
      "<dt>Line value</dt><dd>" +
      P02.formatTaka(row.valuePaisa) +
      "</dd>" +
      "<dt>Expiry</dt><dd>" +
      formatPrettyDate(row.expiry) +
      "</dd>" +
      "<dt>Days left</dt><dd>" +
      row.daysLeft +
      "</dd>" +
      "<dt>Status</dt><dd>" +
      statusMeta(row.bucket).text +
      "</dd>";
    $("detail-modal").hidden = false;
  }

  function render() {
    var data = snapshot();
    $("as-of-date").textContent = formatPrettyDate(state.today);

    setText("count-expired", String(data.counts.expired), String(data.counts.expired));
    setText("count-expiring-30", String(data.counts.expiring_30), String(data.counts.expiring_30));
    setText("count-expiring-90", String(data.counts.expiring_90), String(data.counts.expiring_90));
    setText("count-safe", String(data.counts.safe), String(data.counts.safe));
    setText("count-returned", String(data.counts.returned), String(data.counts.returned));

    setText("value-expired", P02.formatTaka(data.valuesPaisa.expired), data.valuesTaka.expired);
    setText(
      "value-expiring-soon",
      P02.formatTaka(data.valuesPaisa.expiring_30),
      data.valuesTaka.expiring_30
    );
    $("value-expiring-90").textContent = P02.formatTaka(data.valuesPaisa.expiring_90);
    $("value-safe").textContent = P02.formatTaka(data.valuesPaisa.safe);

    $("pct-safe").textContent = data.health.safe + "%";
    $("pct-soon").textContent = data.health.expiringSoon + "%";
    $("pct-expired").textContent = data.health.expired + "%";
    $("bar-safe").style.width = data.health.safe + "%";
    $("bar-soon").style.width = data.health.expiringSoon + "%";
    $("bar-expired").style.width = data.health.expired + "%";

    $("report-expired").textContent = P02.formatTaka(data.valuesPaisa.expired);
    $("report-soon").textContent = P02.formatTaka(data.valuesPaisa.expiring_30);
    $("report-combined").textContent = P02.formatTaka(
      data.valuesPaisa.expired + data.valuesPaisa.expiring_30
    );

    renderUrgent(data);
    renderRegistry(data);
    renderInventory(data);
  }

  function setView(name) {
    state.view = name;
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-view") === name);
    });
    document.querySelectorAll("[data-view-panel]").forEach(function (panel) {
      panel.classList.toggle("is-active", panel.getAttribute("data-view-panel") === name);
    });
  }

  function nextId() {
    var max = 0;
    state.items.forEach(function (item) {
      var n = Number(String(item.id).replace(/\D/g, ""));
      if (n > max) max = n;
    });
    var next = max + 1;
    return "M" + String(next).padStart(3, "0");
  }

  function fillCaseSelect() {
    var select = $("case-select");
    select.innerHTML = allCases()
      .map(function (c) {
        return '<option value="' + escapeHtml(c.case_id) + '">' + escapeHtml(c.case_id) + "</option>";
      })
      .join("");
  }

  function boot() {
    fillCaseSelect();

    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setView(btn.getAttribute("data-view"));
      });
    });

    $("search-input").addEventListener("input", function (e) {
      state.search = e.target.value;
      state.page = 1;
      render();
    });

    $("status-filter").addEventListener("change", function (e) {
      state.statusFilter = e.target.value;
      state.page = 1;
      render();
    });

    $("page-prev").addEventListener("click", function () {
      if (state.page > 1) {
        state.page -= 1;
        render();
      }
    });
    $("page-next").addEventListener("click", function () {
      state.page += 1;
      render();
    });
    $("page-nums").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-page]");
      if (!btn) return;
      state.page = Number(btn.getAttribute("data-page"));
      render();
    });

    $("btn-sort-now").addEventListener("click", function () {
      state.statusFilter = "urgent";
      $("status-filter").value = "urgent";
      state.page = 1;
      setView("dashboard");
      render();
    });

    $("btn-add").addEventListener("click", function () {
      $("add-modal").hidden = false;
    });
    $("btn-add-cancel").addEventListener("click", function () {
      $("add-modal").hidden = true;
    });
    $("add-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData($("add-form"));
      state.items.push({
        id: nextId(),
        name: String(fd.get("name")),
        company: String(fd.get("company") || ""),
        batch: String(fd.get("batch")),
        quantity: Number(fd.get("quantity")),
        unit_price_bdt: String(fd.get("unit_price_bdt")),
        expiry: String(fd.get("expiry")),
      });
      $("add-form").reset();
      $("add-modal").hidden = true;
      render();
    });
    $("btn-detail-close").addEventListener("click", function () {
      $("detail-modal").hidden = true;
    });

    $("btn-load-case").addEventListener("click", function () {
      applyCase(findCase($("case-select").value));
      setView("dashboard");
    });
    $("btn-paste-case").addEventListener("click", function () {
      try {
        applyCase(JSON.parse($("case-paste").value));
        setView("dashboard");
      } catch (err) {
        alert("Invalid JSON");
      }
    });

    window.applyCase = applyCase;
    window.getSnapshot = getSnapshot;
    window.P02App = { markReturned: markReturned, getState: function () { return state; } };

    var params = new URLSearchParams(location.search);
    var requested = params.get("case") || "PUB-01";
    applyCase(findCase(requested) || allCases()[0]);
    if ($("case-select") && requested) $("case-select").value = requested;
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
