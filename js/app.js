(function () {
  var PAGE_SIZE = 5;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var EYE_SVG =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
    '<path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12Z" stroke="currentColor" stroke-width="1.7"/>' +
    '<circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.7"/>' +
    "</svg>";

  var state = {
    caseId: "",
    today: "2026-08-16",
    items: [],
    returnedIds: [],
    search: "",
    statusFilter: "all",
    page: 1,
    returnedPage: 1,
    view: "dashboard",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPrettyDate(iso) {
    if (!iso) return "—";
    var parts = String(iso).split("-");
    return MONTHS[Number(parts[1]) - 1] + " " + Number(parts[2]) + ", " + Number(parts[0]);
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

  function showToast(title, sub, onView) {
    var host = $("toast-host");
    if (!host) return;
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML =
      '<div class="toast-ico" aria-hidden="true">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 12.2 10.2 16.5 18 8" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</div>" +
      '<div class="toast-copy">' +
      '<div class="toast-title">' +
      escapeHtml(title) +
      "</div>" +
      (sub ? '<div class="toast-sub">' + escapeHtml(sub) + "</div>" : "") +
      (onView ? '<button class="toast-action" type="button">View returned list</button>' : "") +
      "</div>" +
      '<button class="toast-close" type="button" aria-label="Dismiss">×</button>';

    function remove() {
      if (toast.classList.contains("is-out")) return;
      toast.classList.add("is-out");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 180);
    }

    toast.querySelector(".toast-close").addEventListener("click", remove);
    var action = toast.querySelector(".toast-action");
    if (action && onView) {
      action.addEventListener("click", function () {
        onView();
        remove();
      });
    }
    host.appendChild(toast);
    setTimeout(remove, 5200);
  }

  function showReturnedList() {
    setView("dashboard");
    var panel = $("returned-panel");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
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
    state.returnedPage = 1;
    if ($("search-input")) $("search-input").value = "";
    if ($("status-filter")) $("status-filter").value = "all";
    render();
    return snapshot();
  }

  function getSnapshot() {
    return snapshot();
  }

  function markReturned(id) {
    if (state.returnedIds.indexOf(id) !== -1) return;
    var item = null;
    state.items.forEach(function (row) {
      if (row.id === id) item = row;
    });
    state.returnedIds.push(id);
    state.returnedPage = Math.max(1, Math.ceil(state.returnedIds.length / PAGE_SIZE));
    render();
    var name = item ? item.name : id;
    var batch = item ? item.batch : "";
    showToast(
      name + " returned to distributor",
      batch ? "Batch " + batch + " left the active groups and taka totals." : "It left the active groups and taka totals.",
      showReturnedList
    );
    showReturnedList();
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

  function rowHtml(row, withActions, withTestids) {
    var meta = statusMeta(row.bucket);
    var rowTest = withTestids ? ' data-testid="item-row-' + escapeHtml(row.id) + '"' : "";
    var returnTest = withTestids ? ' data-testid="btn-return-' + escapeHtml(row.id) + '"' : "";

    var actionCell = "";
    if (withActions) {
      actionCell =
        "<td>" +
        (row.returned
          ? ""
          : '<div class="actions">' +
            '<button class="ghost btn-view" data-id="' +
            escapeHtml(row.id) +
            '" type="button" title="View details" aria-label="View details">' +
            EYE_SVG +
            "</button>" +
            '<button class="btn-return"' +
            returnTest +
            ' data-id="' +
            escapeHtml(row.id) +
            '" type="button">Return</button>' +
            "</div>") +
        "</td>";
    }

    return (
      "<tr" +
      rowTest +
      ' data-bucket="' +
      row.bucket +
      '">' +
      '<td><span class="med-name">' +
      escapeHtml(row.name) +
      "</span></td>" +
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
      actionCell +
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

  function paintPageNums(container, page, pages, attr) {
    if (!container) return;
    container.innerHTML = "";
    var maxBtns = Math.min(pages, 7);
    var start = Math.max(1, Math.min(page - 3, pages - maxBtns + 1));
    if (pages <= 7) start = 1;
    for (var i = 0; i < maxBtns; i++) {
      var n = start + i;
      if (n > pages) break;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "page-num" + (n === page ? " is-active" : "");
      b.textContent = String(n);
      b.setAttribute(attr, String(n));
      container.appendChild(b);
    }
  }

  function renderPagedTable(tbody, rows, page, withTestids, emptyMsg, colspan) {
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
    if (page > pages) page = pages;
    var start = (page - 1) * PAGE_SIZE;
    var visible = {};
    rows.slice(start, start + PAGE_SIZE).forEach(function (row) {
      visible[row.id] = true;
    });

    if (!total) {
      tbody.innerHTML = '<tr><td class="empty-cell" colspan="' + colspan + '">' + emptyMsg + "</td></tr>";
    } else {
      tbody.innerHTML = rows
        .map(function (row) {
          var html = rowHtml(row, false, withTestids);
          if (!visible[row.id]) html = html.replace("<tr ", '<tr class="is-hidden-row" ');
          return html;
        })
        .join("");
    }

    var from = total === 0 ? 0 : start + 1;
    var to = Math.min(start + PAGE_SIZE, total);
    return { total: total, pages: pages, page: page, from: from, to: to };
  }

  function renderRegistry(data) {
    var rows = filteredRows(data);
    var total = rows.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;

    var start = (state.page - 1) * PAGE_SIZE;
    var visible = {};
    rows.slice(start, start + PAGE_SIZE).forEach(function (row) {
      visible[row.id] = true;
    });

    var body = $("registry-body");
    if (!total) {
      body.innerHTML = '<tr><td class="empty-cell" colspan="6">No medicines match this filter.</td></tr>';
    } else {
      body.innerHTML = rows
        .map(function (row) {
          var html = rowHtml(row, true, true);
          if (!visible[row.id]) html = html.replace("<tr ", '<tr class="is-hidden-row" ');
          return html;
        })
        .join("");
      bindRowActions(body);
    }

    var from = total === 0 ? 0 : start + 1;
    var to = Math.min(start + PAGE_SIZE, total);
    $("page-info").textContent = "Showing " + from + "-" + to + " of " + total;

    $("page-prev").disabled = state.page <= 1;
    $("page-next").disabled = state.page >= pages;
    paintPageNums($("page-nums"), state.page, pages, "data-page");
  }

  function renderReturned(data) {
    var rows = data.groups.returned;
    var dash = $("returned-body");
    var inv = $("returned-body-inv");
    var meta = renderPagedTable(
      dash,
      rows,
      state.returnedPage,
      true,
      "Nothing sent back yet. Press Return on a shelf row to move it here.",
      5
    );
    state.returnedPage = meta.page;
    renderPagedTable(
      inv,
      rows,
      state.returnedPage,
      false,
      "Nothing sent back yet. Press Return on a shelf row to move it here.",
      5
    );

    setText("count-returned-inv", String(rows.length));
    var badge = $("nav-returned-badge");
    if (badge) {
      badge.textContent = String(rows.length);
      badge.hidden = rows.length === 0;
    }

    var info = "Showing " + meta.from + "-" + meta.to + " of " + meta.total;
    if ($("returned-page-info")) $("returned-page-info").textContent = info;
    if ($("returned-inv-page-info")) $("returned-inv-page-info").textContent = info;

    if ($("returned-page-prev")) $("returned-page-prev").disabled = state.returnedPage <= 1;
    if ($("returned-page-next")) $("returned-page-next").disabled = state.returnedPage >= meta.pages;
    if ($("returned-inv-page-prev")) $("returned-inv-page-prev").disabled = state.returnedPage <= 1;
    if ($("returned-inv-page-next")) $("returned-inv-page-next").disabled = state.returnedPage >= meta.pages;
    paintPageNums($("returned-page-nums"), state.returnedPage, meta.pages, "data-ret-page");
    paintPageNums($("returned-inv-page-nums"), state.returnedPage, meta.pages, "data-ret-page");
  }

  function renderInventory(data) {
    var inv = $("inventory-body");
    var rows = activeRows(data);
    if (!rows.length) {
      inv.innerHTML = '<tr><td class="empty-cell" colspan="6">No active stock on the shelf.</td></tr>';
    } else {
      inv.innerHTML = rows
        .map(function (row) {
          return rowHtml(row, true, false);
        })
        .join("");
      bindRowActions(inv);
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
      "<dt>ID</dt><dd>" + escapeHtml(row.id) + "</dd>" +
      "<dt>Company</dt><dd>" + escapeHtml(row.company || "—") + "</dd>" +
      "<dt>Batch</dt><dd>" + escapeHtml(row.batch) + "</dd>" +
      "<dt>Quantity</dt><dd>" + row.quantity.toLocaleString("en-US") + "</dd>" +
      "<dt>Unit price</dt><dd>৳" + escapeHtml(String(row.unit_price_bdt)) + "</dd>" +
      "<dt>Line value</dt><dd>" + P02.formatTaka(row.valuePaisa) + "</dd>" +
      "<dt>Expiry</dt><dd>" + formatPrettyDate(row.expiry) + "</dd>" +
      "<dt>Days left</dt><dd>" + row.daysLeft + "</dd>" +
      "<dt>Status</dt><dd>" + statusMeta(row.bucket).text + "</dd>";
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
    setText("value-expiring-soon", P02.formatTaka(data.valuesPaisa.expiring_30), data.valuesTaka.expiring_30);
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

    renderRegistry(data);
    renderInventory(data);
    renderReturned(data);
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
    return "M" + String(max + 1).padStart(3, "0");
  }

  function boot() {
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

    function shiftReturnedPage(delta) {
      state.returnedPage += delta;
      if (state.returnedPage < 1) state.returnedPage = 1;
      render();
    }

    $("returned-page-prev").addEventListener("click", function () {
      if (state.returnedPage > 1) shiftReturnedPage(-1);
    });
    $("returned-page-next").addEventListener("click", function () {
      shiftReturnedPage(1);
    });
    $("returned-inv-page-prev").addEventListener("click", function () {
      if (state.returnedPage > 1) shiftReturnedPage(-1);
    });
    $("returned-inv-page-next").addEventListener("click", function () {
      shiftReturnedPage(1);
    });
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ret-page]");
      if (!btn) return;
      state.returnedPage = Number(btn.getAttribute("data-ret-page"));
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
      showToast("Medicine added to the shelf", String(fd.get("name")));
    });

    $("btn-detail-close").addEventListener("click", function () {
      $("detail-modal").hidden = true;
    });

    document.querySelectorAll(".modal").forEach(function (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) modal.hidden = true;
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        $("add-modal").hidden = true;
        $("detail-modal").hidden = true;
      }
    });

    window.applyCase = applyCase;
    window.getSnapshot = getSnapshot;
    window.P02App = {
      markReturned: markReturned,
      getState: function () {
        return state;
      },
    };

    var params = new URLSearchParams(location.search);
    var requested = params.get("case") || "PUB-01";
    applyCase(findCase(requested) || allCases()[0]);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();