(function (global) {
  var DAY_MS = 86400000;

  function parseDateUTC(iso) {
    var parts = String(iso).split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    return Date.UTC(y, m - 1, d);
  }

  function daysLeft(expiry, today) {
    return Math.round((parseDateUTC(expiry) - parseDateUTC(today)) / DAY_MS);
  }

  function unitPaisa(priceStr) {
    var raw = String(priceStr == null ? "0" : priceStr).trim();
    var pieces = raw.split(".");
    var whole = pieces[0] === "" || pieces[0] === "-" ? "0" : pieces[0];
    var frac = (pieces[1] || "") + "00";
    frac = frac.slice(0, 2);
    var sign = whole.charAt(0) === "-" ? -1 : 1;
    if (whole.charAt(0) === "-") whole = whole.slice(1);
    return sign * (parseInt(whole, 10) * 100 + parseInt(frac, 10));
  }

  function lineValuePaisa(item) {
    return Number(item.quantity) * unitPaisa(item.unit_price_bdt);
  }

  function paisaToTaka(paisa) {
    var sign = paisa < 0 ? "-" : "";
    var abs = Math.abs(Math.round(paisa));
    var whole = String(Math.floor(abs / 100));
    var frac = String(abs % 100);
    if (frac.length < 2) frac = "0" + frac;
    return sign + whole + "." + frac;
  }

  function formatTaka(paisa) {
    var taka = paisaToTaka(paisa);
    var pieces = taka.split(".");
    var whole = pieces[0];
    var sign = "";
    if (whole.charAt(0) === "-") {
      sign = "-";
      whole = whole.slice(1);
    }
    var grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "৳" + sign + grouped + "." + pieces[1];
  }

  function bucketOf(days) {
    if (days < 0) return "expired";
    if (days <= 30) return "expiring_30";
    if (days <= 90) return "expiring_90";
    return "safe";
  }

  function classifyItem(item, today, returnedIds) {
    var returned = returnedIds && returnedIds[item.id];
    var days = daysLeft(item.expiry, today);
    var bucket = returned ? "returned" : bucketOf(days);
    var valuePaisa = lineValuePaisa(item);
    return {
      id: item.id,
      name: item.name,
      company: item.company || "",
      batch: item.batch,
      quantity: Number(item.quantity),
      unit_price_bdt: item.unit_price_bdt,
      expiry: item.expiry,
      daysLeft: days,
      bucket: bucket,
      returned: !!returned,
      valuePaisa: valuePaisa,
      valueTaka: paisaToTaka(valuePaisa),
    };
  }

  function analyze(items, today, returnedIdList) {
    var returnedIds = {};
    (returnedIdList || []).forEach(function (id) {
      returnedIds[id] = true;
    });

    var classified = (items || []).map(function (item) {
      return classifyItem(item, today, returnedIds);
    });

    var groups = {
      expired: [],
      expiring_30: [],
      expiring_90: [],
      safe: [],
      returned: [],
    };

    classified.forEach(function (row) {
      groups[row.bucket].push(row);
    });

    function sumPaisa(rows) {
      return rows.reduce(function (acc, row) {
        return acc + row.valuePaisa;
      }, 0);
    }

    var valuesPaisa = {
      expired: sumPaisa(groups.expired),
      expiring_30: sumPaisa(groups.expiring_30),
      expiring_90: sumPaisa(groups.expiring_90),
      safe: sumPaisa(groups.safe),
      returned: sumPaisa(groups.returned),
    };

    var counts = {
      expired: groups.expired.length,
      expiring_30: groups.expiring_30.length,
      expiring_90: groups.expiring_90.length,
      safe: groups.safe.length,
      returned: groups.returned.length,
    };

    var activeCount =
      counts.expired + counts.expiring_30 + counts.expiring_90 + counts.safe;

    var healthExpired = 0;
    var healthSoon = 0;
    var healthSafe = 0;
    if (activeCount) {
      healthExpired = Math.round((counts.expired / activeCount) * 100);
      healthSoon = Math.round((counts.expiring_30 / activeCount) * 100);
      healthSafe = Math.max(0, 100 - healthExpired - healthSoon);
    }

    return {
      today: today,
      classified: classified,
      groups: groups,
      counts: counts,
      valuesPaisa: valuesPaisa,
      valuesTaka: {
        expired: paisaToTaka(valuesPaisa.expired),
        expiring_30: paisaToTaka(valuesPaisa.expiring_30),
        expiring_90: paisaToTaka(valuesPaisa.expiring_90),
        safe: paisaToTaka(valuesPaisa.safe),
        returned: paisaToTaka(valuesPaisa.returned),
      },
      health: {
        safe: healthSafe,
        expiringSoon: healthSoon,
        expired: healthExpired,
        activeCount: activeCount,
      },
    };
  }

  global.P02 = {
    daysLeft: daysLeft,
    unitPaisa: unitPaisa,
    lineValuePaisa: lineValuePaisa,
    paisaToTaka: paisaToTaka,
    formatTaka: formatTaka,
    bucketOf: bucketOf,
    classifyItem: classifyItem,
    analyze: analyze,
  };
})(typeof window !== "undefined" ? window : globalThis);
