let allBooks = [];
let editingBookId = null;
let booksVisible = false;
let currentPage = 1;
let pageSize = 20;
let currentSort = "recent";
let tesseractLoaderPromise = null;

const els = {
  messageBox: document.getElementById("messageBox"),
  books: document.getElementById("books"),
  booksWrapper: document.getElementById("booksWrapper"),
  resultsCount: document.getElementById("resultsCount"),
  pageInfo: document.getElementById("pageInfo"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  sortSelect: document.getElementById("sortSelect"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),

  title: document.getElementById("title"),
  author: document.getElementById("author"),
  genre: document.getElementById("genre"),
  status: document.getElementById("status"),
  notes: document.getElementById("notes"),

  searchAll: document.getElementById("searchAll"),
  fTitle: document.getElementById("fTitle"),
  fAuthor: document.getElementById("fAuthor"),
  fGenre: document.getElementById("fGenre"),
  fStatus: document.getElementById("fStatus"),
  fNotes: document.getElementById("fNotes"),

  scanBookBtn: document.getElementById("scanBookBtn"),
  clearScanBtn: document.getElementById("clearScanBtn"),
  scanImageInput: document.getElementById("scanImageInput"),
  scanPreviewWrapper: document.getElementById("scanPreviewWrapper"),
  scanPreview: document.getElementById("scanPreview"),
  scanStatus: document.getElementById("scanStatus"),

  manualIsbn: document.getElementById("manualIsbn"),
  searchManualIsbnBtn: document.getElementById("searchManualIsbnBtn"),
  clearManualIsbnBtn: document.getElementById("clearManualIsbnBtn")
};

const filterKeys = ["searchAll", "fTitle", "fAuthor", "fGenre", "fStatus", "fNotes"];

function showMessage(text, type = "info") {
  if (!els.messageBox) return;
  els.messageBox.textContent = text;
  els.messageBox.className = `message ${type}`;
  els.messageBox.classList.remove("hidden");
}

function clearMessage() {
  if (!els.messageBox) return;
  els.messageBox.textContent = "";
  els.messageBox.className = "message hidden";
}

function setScanStatus(text) {
  if (els.scanStatus) {
    els.scanStatus.textContent = text || "";
  }
}

function sanitize(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function saveFilters() {
  try {
    const payload = {};
    filterKeys.forEach((key) => {
      if (els[key]) payload[key] = els[key].value;
    });
    localStorage.setItem("biblioteca-filters", JSON.stringify(payload));
  } catch (error) {
    console.warn("Impossibile salvare i filtri", error);
  }
}

function loadFilters() {
  try {
    const raw = localStorage.getItem("biblioteca-filters");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    filterKeys.forEach((key) => {
      if (els[key] && parsed[key] !== undefined) {
        els[key].value = parsed[key];
      }
    });
  } catch (error) {
    console.warn("Filtri non validi, li rimuovo", error);
    localStorage.removeItem("biblioteca-filters");
  }
}

function hasActiveFilters() {
  return filterKeys.some((key) => normalize(els[key]?.value));
}

function showBooks() {
  booksVisible = true;
  els.booksWrapper?.classList.remove("hidden");
}

function hideBooks() {
  booksVisible = false;
  els.booksWrapper?.classList.add("hidden");
}

function resetFilters() {
  filterKeys.forEach((key) => {
    if (els[key]) els[key].value = "";
  });

  localStorage.removeItem("biblioteca-filters");
  currentPage = 1;
  hideBooks();

  if (els.resultsCount) els.resultsCount.textContent = "0 libri";
  if (els.books) els.books.innerHTML = "";
  if (els.pageInfo) els.pageInfo.textContent = "Pagina 1 di 1";
}

function clearForm() {
  editingBookId = null;
  if (els.title) els.title.value = "";
  if (els.author) els.author.value = "";
  if (els.genre) els.genre.value = "";
  if (els.status) els.status.value = "Da leggere";
  if (els.notes) els.notes.value = "";
}

function clearScanArea() {
  if (els.scanImageInput) els.scanImageInput.value = "";
  if (els.scanPreview) els.scanPreview.src = "";
  if (els.scanPreviewWrapper) els.scanPreviewWrapper.classList.add("hidden");
  setScanStatus("Nessuna scansione effettuata.");
}

function clearManualIsbn() {
  if (els.manualIsbn) els.manualIsbn.value = "";
}

function sortBooks(data) {
  const sorted = [...(data || [])];

  if (currentSort === "title-asc") {
    sorted.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title), "it"));
    return sorted;
  }

  if (currentSort === "author-asc") {
    sorted.sort((a, b) => normalize(a.author).localeCompare(normalize(b.author), "it"));
    return sorted;
  }

  sorted.sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return sorted;
}

function applyClientFilters(data) {
  const quick = normalize(els.searchAll?.value);
  const fTitle = normalize(els.fTitle?.value);
  const fAuthor = normalize(els.fAuthor?.value);
  const fGenre = normalize(els.fGenre?.value);
  const fStatus = normalize(els.fStatus?.value);
  const fNotes = normalize(els.fNotes?.value);

  saveFilters();

  return (data || []).filter((book) => {
    const haystack = normalize(
      [book.title, book.author, book.genre, book.status, book.notes].join(" ")
    );

    if (quick && !haystack.includes(quick)) return false;
    if (fTitle && !normalize(book.title).includes(fTitle)) return false;
    if (fAuthor && !normalize(book.author).includes(fAuthor)) return false;
    if (fGenre && !normalize(book.genre).includes(fGenre)) return false;
    if (fStatus && normalize(book.status) !== fStatus) return false;
    if (fNotes && !normalize(book.notes).includes(fNotes)) return false;

    return true;
  });
}

function renderBooks(data) {
  const filtered = sortBooks(applyClientFilters(data || []));
  const count = filtered.length;

  if (els.resultsCount) {
    els.resultsCount.textContent = count === 1 ? "1 libro" : `${count} libri`;
  }

  if (!booksVisible && !hasActiveFilters()) {
    hideBooks();
    return;
  }

  if (hasActiveFilters()) {
    showBooks();
  }

  if (!els.books) return;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  if (els.pageInfo) {
    els.pageInfo.textContent = `Pagina ${currentPage} di ${totalPages}`;
  }

  if (els.prevPageBtn) {
    els.prevPageBtn.disabled = currentPage === 1;
  }

  if (els.nextPageBtn) {
    els.nextPageBtn.disabled = currentPage === totalPages;
  }

  if (!pageItems.length) {
    els.books.innerHTML = `
      <tr>
        <td colspan="6" class="empty-row">Nessun libro trovato.</td>
      </tr>
    `;
    return;
  }

  els.books.innerHTML = pageItems
    .map((book) => `
      <tr>
        <td>${sanitize(book.title || "")}</td>
        <td>${sanitize(book.author || "")}</td>
        <td>${sanitize(book.genre || "")}</td>
        <td>${sanitize(book.status || "")}</td>
        <td>${sanitize(book.notes || "")}</td>
        <td class="row-actions">
          <button type="button" class="secondary" data-edit="${sanitize(book.id || "")}">Modifica</button>
          <button type="button" class="danger" data-delete="${sanitize(book.id || "")}">Elimina</button>
        </td>
      </tr>
    `)
    .join("");
}

async function fetchBooks() {
  clearMessage();

  if (typeof sb === "undefined" || !sb) {
    showMessage("Supabase non inizializzato. Controlla il file di configurazione.", "error");
    return;
  }

  try {
    const { data, error } = await sb
      .from("books")
      .select("id, title, author, genre, status, notes, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      showMessage(`Errore caricamento libri: ${error.message}`, "error");
      return;
    }

    allBooks = data || [];
    renderBooks(allBooks);
  } catch (error) {
    console.error("Errore fetchBooks:", error);
    showMessage("Errore imprevisto durante il caricamento dei libri.", "error");
  }
}

async function saveBook() {
  clearMessage();

  const title = els.title?.value.trim() || "";
  const author = els.author?.value.trim() || "";
  const genre = els.genre?.value.trim() || "";
  const status = els.status?.value || "Da leggere";
  const notes = els.notes?.value.trim() || "";

  if (!title) {
    showMessage("Il titolo è obbligatorio.", "error");
    return;
  }

  if (typeof sb === "undefined" || !sb) {
    showMessage("Supabase non inizializzato. Controlla il file di configurazione.", "error");
    return;
  }

  const payload = { title, author, genre, status, notes };
  const wasEditing = !!editingBookId;

  try {
    let response;

    if (editingBookId) {
      response = await sb
        .from("books")
        .update(payload)
        .eq("id", editingBookId)
        .select();
    } else {
      response = await sb
        .from("books")
        .insert([payload])
        .select();
    }

    if (response.error) {
      showMessage(`Errore salvataggio: ${response.error.message}`, "error");
      return;
    }

    clearForm();
    clearScanArea();
    clearManualIsbn();
    showMessage(wasEditing ? "Libro aggiornato." : "Libro salvato.", "success");
    showBooks();
    currentPage = 1;
    await fetchBooks();
  } catch (error) {
    console.error("Errore saveBook:", error);
    showMessage("Errore imprevisto durante il salvataggio.", "error");
  }
}

function editBook(id) {
  const book = allBooks.find((item) => String(item.id) === String(id));
  if (!book) return;

  editingBookId = book.id;
  if (els.title) els.title.value = book.title || "";
  if (els.author) els.author.value = book.author || "";
  if (els.genre) els.genre.value = book.genre || "";
  if (els.status) els.status.value = book.status || "Da leggere";
  if (els.notes) els.notes.value = book.notes || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteBook(id) {
  const confirmed = window.confirm("Vuoi eliminare questo libro?");
  if (!confirmed) return;

  if (typeof sb === "undefined" || !sb) {
    showMessage("Supabase non inizializzato. Controlla il file di configurazione.", "error");
    return;
  }

  try {
    const { error } = await sb
      .from("books")
      .delete()
      .eq("id", id);

    if (error) {
      showMessage(`Errore eliminazione: ${error.message}`, "error");
      return;
    }

    showMessage("Libro eliminato.", "success");
    await fetchBooks();
  } catch (error) {
    console.error("Errore deleteBook:", error);
    showMessage("Errore imprevisto durante l'eliminazione.", "error");
  }
}

function fillFieldsFromBookData({ title = "", author = "", genre = "" }) {
  if (title && els.title) els.title.value = title;
  if (author && els.author) els.author.value = author;
  if (genre && els.genre) els.genre.value = genre;
}

function setManualIsbn(value) {
  if (els.manualIsbn && value) {
    els.manualIsbn.value = value;
  }
}

function cleanManualIsbn(value) {
  return String(value || "")
    .replace(/[\s\-]/g, "")
    .toUpperCase();
}

function isValidIsbnFormat(value) {
  return /^(97[89]\d{10}|\d{9}[0-9X])$/.test(value);
}

async function searchByManualIsbn() {
  clearMessage();

  const raw = els.manualIsbn?.value || "";
  const isbn = cleanManualIsbn(raw);

  if (!isbn) {
    showMessage("Inserisci un ISBN.", "error");
    setScanStatus("Inserisci un ISBN manuale.");
    return;
  }

  if (!isValidIsbnFormat(isbn)) {
    showMessage("Formato ISBN non valido.", "error");
    setScanStatus("Formato ISBN non valido.");
    return;
  }

  try {
    setScanStatus(`Cerco il libro con ISBN ${isbn}...`);
    const found = await lookupBookByIsbn(isbn);

    if (found) {
      setManualIsbn(isbn);
      fillFieldsFromBookData(found);
      showMessage("Libro trovato da ISBN manuale.", "success");
      setScanStatus(`ISBN ${isbn} trovato.`);
      return;
    }

    showMessage("ISBN valido, ma nessun libro trovato online.", "info");
    setScanStatus(`ISBN ${isbn} non trovato online.`);
  } catch (error) {
    console.error("Errore ricerca ISBN manuale:", error);
    showMessage("Errore durante la ricerca ISBN.", "error");
    setScanStatus("Errore durante la ricerca ISBN.");
  }
}

async function fileToImageElement(file) {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere l'immagine."));
    };

    img.src = url;
  });
}

function drawImageToCanvas(img, crop = null) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const fullWidth = img.naturalWidth || img.width;
  const fullHeight = img.naturalHeight || img.height;

  const sx = crop?.sx || 0;
  const sy = crop?.sy || 0;
  const sw = crop?.sw || fullWidth;
  const sh = crop?.sh || fullHeight;

  canvas.width = sw;
  canvas.height = sh;

  ctx.drawImage(
    img,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    sw,
    sh
  );

  return canvas;
}

async function detectBarcodeFromSource(source) {
  if (!("BarcodeDetector" in window)) return null;

  try {
    const detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
    });

    const codes = await detector.detect(source);
    if (!codes || !codes.length) return null;

    for (const code of codes) {
      const raw = String(code.rawValue || "").replace(/[^\dXx]/g, "");
      if (/^(97[89]\d{10}|\d{9}[0-9Xx])$/.test(raw)) {
        return raw.toUpperCase();
      }
    }

    return null;
  } catch (error) {
    console.warn("BarcodeDetector error:", error);
    return null;
  }
}

function downscaleCanvasIfNeeded(sourceCanvas, maxWidth = 1600) {
  if (!sourceCanvas || sourceCanvas.width <= maxWidth) {
    return sourceCanvas;
  }

  const ratio = maxWidth / sourceCanvas.width;
  const targetWidth = Math.round(sourceCanvas.width * ratio);
  const targetHeight = Math.round(sourceCanvas.height * ratio);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  return canvas;
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossibile convertire il canvas in immagine."));
    }, type, quality);
  });
}

async function detectIsbnFromImage(file) {
  try {
    const img = await fileToImageElement(file);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    let isbn = await detectBarcodeFromSource(img);
    if (isbn) return isbn;

    if ("createImageBitmap" in window) {
      try {
        const bitmap = await createImageBitmap(file);
        isbn = await detectBarcodeFromSource(bitmap);
        if (isbn) return isbn;
      } catch (error) {
        console.warn("createImageBitmap fallito:", error);
      }
    }

    const fullCanvas = downscaleCanvasIfNeeded(drawImageToCanvas(img), 1800);
    isbn = await detectBarcodeFromSource(fullCanvas);
    if (isbn) return isbn;

    const lowerHalf = downscaleCanvasIfNeeded(
      drawImageToCanvas(img, {
        sx: 0,
        sy: Math.floor(height * 0.5),
        sw: width,
        sh: Math.floor(height * 0.5)
      }),
      1800
    );
    isbn = await detectBarcodeFromSource(lowerHalf);
    if (isbn) return isbn;

    const lowerWide = downscaleCanvasIfNeeded(
      drawImageToCanvas(img, {
        sx: Math.floor(width * 0.08),
        sy: Math.floor(height * 0.60),
        sw: Math.floor(width * 0.84),
        sh: Math.floor(height * 0.30)
      }),
      1800
    );
    isbn = await detectBarcodeFromSource(lowerWide);
    if (isbn) return isbn;

    const lowerCenter = downscaleCanvasIfNeeded(
      drawImageToCanvas(img, {
        sx: Math.floor(width * 0.18),
        sy: Math.floor(height * 0.68),
        sw: Math.floor(width * 0.64),
        sh: Math.floor(height * 0.20)
      }),
      1800
    );
    isbn = await detectBarcodeFromSource(lowerCenter);
    if (isbn) return isbn;

    return null;
  } catch (error) {
    console.warn("detectIsbnFromImage fallita:", error);
    return null;
  }
}

function extractIsbnFromText(text) {
  const cleaned = String(text || "")
    .replace(/[\s\-]/g, "")
    .toUpperCase();

  const match13 = cleaned.match(/97[89]\d{10}/);
  if (match13) return match13[0];

  const match10 = cleaned.match(/\d{9}[0-9X]/);
  if (match10) return match10[0];

  return null;
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;

  if (!tesseractLoaderPromise) {
    tesseractLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;

      script.onload = () => {
        if (window.Tesseract) {
          resolve(window.Tesseract);
        } else {
          reject(new Error("Tesseract caricato ma non disponibile."));
        }
      };

      script.onerror = () => {
        reject(new Error("Impossibile caricare Tesseract."));
      };

      document.head.appendChild(script);
    });
  }

  return tesseractLoaderPromise;
}

async function runOcr(input) {
  const Tesseract = await loadTesseract();

  try {
    const result = await Tesseract.recognize(input, "eng");
    return result?.data?.text || "";
  } catch (error) {
    console.warn("OCR fallito", error);
    throw new Error("OCR non riuscito.");
  }
}

async function runOcrForIsbn(file) {
  const img = await fileToImageElement(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const lowerCanvas = drawImageToCanvas(img, {
    sx: 0,
    sy: Math.floor(height * 0.55),
    sw: width,
    sh: Math.floor(height * 0.45)
  });

  const optimizedCanvas = downscaleCanvasIfNeeded(lowerCanvas, 1800);
  const blob = await canvasToBlob(optimizedCanvas, "image/jpeg", 0.95);
  return await runOcr(blob);
}

function parseCoverText(text) {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 2)
    .filter((l) => !/^\d+$/.test(l))
    .filter((l) => !/^isbn/i.test(l));

  const candidates = lines
    .filter((l) => l.length < 80)
    .slice(0, 4);

  return {
    raw: candidates.join(" "),
    title: candidates[0] || "",
    author: candidates[1] || ""
  };
}

async function fetchJsonWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function lookupBookByIsbn(isbn) {
  const url = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}`;
  const data = await fetchJsonWithTimeout(url, 10000);
  const doc = data?.docs?.[0];
  if (!doc) return null;

  return {
    title: doc.title || "",
    author: doc.author_name?.[0] || "",
    genre: doc.subject?.[0] || ""
  };
}

async function lookupBookByTitleAuthor(title, author) {
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (author) params.set("author", author);

  const url = `https://openlibrary.org/search.json?${params.toString()}`;
  const data = await fetchJsonWithTimeout(url, 10000);
  const doc = data?.docs?.[0];
  if (!doc) return null;

  return {
    title: doc.title || title || "",
    author: doc.author_name?.[0] || author || "",
    genre: doc.subject?.[0] || ""
  };
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Errore lettura file."));
    reader.readAsDataURL(file);
  });
}

async function analyzeCoverWithAI(file) {
  const endpoint = window.AI_SCAN_ENDPOINT;
  if (!endpoint) return null;

  const base64Image = await fileToBase64(file);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image_base64: base64Image,
      mime_type: file.type || "image/jpeg"
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const details =
      data?.details ||
      data?.error ||
      `Errore server ${response.status}`;
    throw new Error(details);
  }

  return {
    title: data.title || "",
    author: data.author || "",
    genre: data.genre || ""
  };
}

async function handleScanFile(file) {
  if (!file) return;

  clearMessage();
  setScanStatus("Analisi immagine in corso...");

  let previewUrl = "";

  try {
    previewUrl = URL.createObjectURL(file);

    if (els.scanPreview) {
      els.scanPreview.src = previewUrl;
    }

    if (els.scanPreviewWrapper) {
      els.scanPreviewWrapper.classList.remove("hidden");
    }

    setScanStatus("Provo a leggere il codice ISBN...");
    let isbn = await detectIsbnFromImage(file);

    let ocrText = "";

    if (!isbn) {
      setScanStatus("Barcode non trovato. Provo OCR mirato per ISBN...");
      ocrText = await runOcrForIsbn(file);
      isbn = extractIsbnFromText(ocrText);
    }

    if (isbn) {
      setManualIsbn(isbn);
      setScanStatus(`ISBN trovato (${isbn}). Recupero i dati online...`);
      const foundByIsbn = await lookupBookByIsbn(isbn);

      if (foundByIsbn) {
        fillFieldsFromBookData(foundByIsbn);
        setScanStatus(`ISBN trovato (${isbn}). Campi compilati automaticamente.`);
        showMessage("Libro riconosciuto da ISBN. Controlla i campi e salva.", "success");
        return;
      }

      setScanStatus(`ISBN trovato (${isbn}), ma nessun risultato online.`);
      showMessage("ISBN letto, ma non ho trovato il libro online.", "info");
      return;
    }

    if (!ocrText) {
      setScanStatus("Provo a leggere il testo della copertina...");
      ocrText = await runOcr(file);
    }

    const guessed = parseCoverText(ocrText);
    let found = null;

    if (guessed.title) {
      found = await lookupBookByTitleAuthor(guessed.title, guessed.author);
    }

    if (!found && guessed.raw) {
      found = await lookupBookByTitleAuthor(guessed.raw, "");
    }

    if (found) {
      fillFieldsFromBookData(found);
      setScanStatus("Copertina letta. Controlla i campi e correggi se serve.");
      showMessage("Dati trovati dalla copertina. Verifica prima di salvare.", "success");
      return;
    }

    fillFieldsFromBookData(guessed);
    setScanStatus("ISBN non trovato. Ho provato solo barcode e OCR.");
    showMessage("Non ho trovato un ISBN leggibile. Puoi inserire l'ISBN manualmente.", "info");
    return;
  } catch (error) {
    console.error("Errore scansione:", error);
    setScanStatus(error.message || "Errore durante la scansione.");
    showMessage(error.message || "Errore durante la scansione del libro.", "error");
  } finally {
    if (previewUrl) {
      setTimeout(() => URL.revokeObjectURL(previewUrl), 1000);
    }
  }
}

function bindStaticEvents() {
  document.getElementById("saveBookBtn")?.addEventListener("click", saveBook);
  document.getElementById("clearFormBtn")?.addEventListener("click", clearForm);
  document.getElementById("refreshBtn")?.addEventListener("click", fetchBooks);

  document.getElementById("applyFiltersBtn")?.addEventListener("click", () => {
    currentPage = 1;
    showBooks();
    renderBooks(allBooks);
  });

  document.getElementById("resetFiltersBtn")?.addEventListener("click", resetFilters);

  document.getElementById("showBooksBtn")?.addEventListener("click", () => {
    currentPage = 1;
    showBooks();
    renderBooks(allBooks);
  });

  document.getElementById("hideBooksBtn")?.addEventListener("click", () => {
    hideBooks();
    renderBooks(allBooks);
  });

  els.pageSizeSelect?.addEventListener("change", () => {
    pageSize = Number(els.pageSizeSelect.value) || 20;
    currentPage = 1;
    renderBooks(allBooks);
  });

  els.sortSelect?.addEventListener("change", () => {
    currentSort = els.sortSelect.value || "recent";
    currentPage = 1;
    renderBooks(allBooks);
  });

  els.prevPageBtn?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderBooks(allBooks);
    }
  });

  els.nextPageBtn?.addEventListener("click", () => {
    const total = Math.max(1, Math.ceil(sortBooks(applyClientFilters(allBooks)).length / pageSize));
    if (currentPage < total) {
      currentPage++;
      renderBooks(allBooks);
    }
  });

  filterKeys.forEach((key) => {
    els[key]?.addEventListener("input", () => {
      currentPage = 1;
      if (hasActiveFilters()) showBooks();
      renderBooks(allBooks);
    });

    els[key]?.addEventListener("change", () => {
      currentPage = 1;
      if (hasActiveFilters()) showBooks();
      renderBooks(allBooks);
    });
  });

  els.books?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const editId = target.getAttribute("data-edit");
    const deleteId = target.getAttribute("data-delete");

    if (editId) editBook(editId);
    if (deleteId) deleteBook(deleteId);
  });

  els.scanBookBtn?.addEventListener("click", () => {
    els.scanImageInput?.click();
  });

  els.clearScanBtn?.addEventListener("click", () => {
    clearScanArea();
  });

  els.scanImageInput?.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (file) await handleScanFile(file);
  });

  els.searchManualIsbnBtn?.addEventListener("click", searchByManualIsbn);

  els.clearManualIsbnBtn?.addEventListener("click", () => {
    clearManualIsbn();
    setScanStatus("ISBN manuale pulito.");
  });

  els.manualIsbn?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchByManualIsbn();
    }
  });
}

async function bootstrap() {
  try {
    loadFilters();
    hideBooks();
    clearScanArea();

    if (els.pageSizeSelect) {
      pageSize = Number(els.pageSizeSelect.value) || 20;
    }

    if (els.sortSelect) {
      currentSort = els.sortSelect.value || "recent";
    }

    bindStaticEvents();
    await fetchBooks();
  } catch (error) {
    console.error("Errore bootstrap:", error);
    showMessage("Errore durante l'avvio dell'app.", "error");
  }
}

bootstrap();
