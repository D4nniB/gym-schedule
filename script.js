const SHEET_ID = "1jix3N3BtlyGDUcd2p4CmNFvZ4JTni6sGbhabyPpAjSo";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

document.addEventListener("DOMContentLoaded", () => {
  initSchedule();
});

async function initSchedule() {
  const table = document.getElementById("table");
  const dayLabel = document.getElementById("day-label");
  const errorMessage = document.getElementById("error-message");

  try {
    if (location.protocol === "file:") {
      errorMessage.textContent =
        "Get ekki sótt gögn frá Google Sheets þegar síðan er opnuð beint af diski. Opnaðu hana í gegnum http://localhost (t.d. með Live Server).";
      return;
    }

    const todayIcelandic = getTodayIcelandic();
    dayLabel.textContent = todayIcelandic;

    const csvText = await fetchCsv(CSV_URL);
    const rows = parseCsv(csvText);

    if (rows.length === 0) {
      errorMessage.textContent = "Engin gögn fundust í skjalinu.";
      return;
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    const idxHópur = header.indexOf("Hópur");
    const idxÞjálfari = header.indexOf("Þjálfari");
    const idxDagur = header.indexOf("Dagur");
    const idxStart = header.findIndex((h) => h.toLowerCase().startsWith("tími - start"));
    const idxEnd = header.findIndex((h) => h.toLowerCase().startsWith("tími - end"));

    if (idxHópur === -1 || idxDagur === -1 || idxStart === -1) {
      errorMessage.textContent = "Hauslína í skjalinu passar ekki við væntanlegt snið.";
      return;
    }

    const todayRows = dataRows
      .map((r) => r.map((c) => c.trim()))
      .filter((r) => r[idxDagur] && equalIcelandicDay(r[idxDagur], todayIcelandic))
      .filter((r) => r[idxHópur]);

    if (todayRows.length === 0) {
      errorMessage.textContent = "Engir tímar skráðir fyrir þennan dag.";
      return;
    }

    todayRows.sort((a, b) => {
      const aMinutes = timeToMinutes(a[idxStart]);
      const bMinutes = timeToMinutes(b[idxStart]);
      return aMinutes - bMinutes;
    });

    const existing = Array.from(table.querySelectorAll(".data-row"));
    existing.forEach((el) => el.remove());

    for (const row of todayRows) {
      let group = row[idxHópur] || "";
      let coach = idxÞjálfari !== -1 ? row[idxÞjálfari] || "" : "";
      const start = row[idxStart] || "";
      const end = idxEnd !== -1 ? row[idxEnd] || "" : "";

      // Cells may contain "Hópur Mfl Frjálsar" etc. Strip the leading label.
      group = group.replace(/^Hópur\s*/i, "").trim();
      coach = coach.replace(/^Þjálfari\s*/i, "").trim();

      let timeLabelRaw = end ? `${start}-${end}` : start;
      timeLabelRaw = timeLabelRaw.replace(/^Tími\s*/i, "").trim();
      const timeLabel = timeLabelRaw;

      addCell(table, group, "data-row");
      addCell(table, coach, "data-row");
      addCell(table, timeLabel, "data-row");
    }
  } catch (err) {
    console.error(err);
    errorMessage.textContent = `Tókst ekki að hlaða gögn frá Google Sheets (${err.message}).`;
  }
}

function addCell(table, text, rowClass) {
  const div = document.createElement("div");
  div.className = `cell ${rowClass}`;
  const inner = document.createElement("span");
  inner.className = "cell-inner";
  inner.textContent = text;
  div.appendChild(inner);
  table.appendChild(div);
}

async function fetchCsv(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    // Commonly this is a 403 if the sheet is not shared
    // as "Anyone with the link can view".
    throw new Error(`CSV fetch failed: HTTP ${res.status}`);
  }
  return res.text();
}

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

function getTodayIcelandic() {
  // Some browsers may not return Icelandic even with "is-IS",
  // so use a manual mapping based on weekday index.
  const d = new Date();
  const weekdayIndex = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const weekdaysIs = [
    "Sunnudagur",
    "Mánudagur",
    "Þriðjudagur",
    "Miðvikudagur",
    "Fimmtudagur",
    "Föstudagur",
    "Laugardagur",
  ];
  return weekdaysIs[weekdayIndex];
}

function equalIcelandicDay(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function timeToMinutes(timeStr) {
  if (!timeStr) return Number.POSITIVE_INFINITY;
  const trimmed = timeStr.toString().trim();

  // Formats we support:
  // "17" or "9"        -> hours only
  // "17:00" or "9:30"  -> hours:minutes
  // "17.00" or "9.30"  -> hours.minutes

  // Hours only
  if (/^\d{1,2}$/.test(trimmed)) {
    const hOnly = Number(trimmed);
    if (Number.isNaN(hOnly)) return Number.POSITIVE_INFINITY;
    return hOnly * 60;
  }

  // Hours + minutes with ":" or "."
  const parts = trimmed.split(/[:.]/);
  if (parts.length === 2) {
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return Number.POSITIVE_INFINITY;
    return h * 60 + m;
  }

  // Fallback: unknown format goes last
  return Number.POSITIVE_INFINITY;
}

