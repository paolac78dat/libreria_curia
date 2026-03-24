let allBooks = [];
let editingBookId = null;
let booksVisible = false;
let currentPage = 1;
let pageSize = 20;
let currentSort = "recent";

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
  scanStatus: document.getElementById("scanStatus")
};

const filterKeys = ["searchAll", "fTitle", "fAuthor", "fGenre", "fStatus", "fNotes"];
let tesseractLoaderPromise = null;

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
    els.scanStatus.textContent = text;
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
  const payload = {};
  filterKeys.forEach((key) => {
    if (els[key]) payload[key] = els[key].value;
  });
  localStorage.setItem("biblioteca-filters", JSON.stringify(payload));
}

function loadFilters() {
  const raw = localStorage.getItem("biblioteca-filters");
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    filterKeys.forEach((key) => {
      if (els[key] && parsed[key] !== undefined) {
        els[key].value = parsed[key];
      }
    });
  } catch {
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

  if (els.resultsCount) {
    els.resultsCount.textContent = "0 libri";
  }

  if (els.books) {
    els.books.innerHTML = "";
  }

  if (els.pageInfo) {
    els.pageInfo.textContent = "Pagina 1 di 1";
  }
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

function sortBooks(data) {
  const sorted = [...data];

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

  return data.filter((book) => {
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
          <button class="secondary" data-edit="${book.id}">Modifica</button>
          <button class="danger" data-delete="${book.id}">Elimina</button>
        </td>
      </tr>
    `)
    .join("");
}

async function fetchBooks() {
  clearMessage();

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

  const payload = {
    title,
    author,
    genre,
    status,
    notes
  };

  let response;
  const wasEditing = !!editingBookId;

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
  showMessage(wasEditing ? "Libro aggiornato." : "Libro salvato.", "success");
  showBooks();
  currentPage = 1;
  await fetchBooks();
}

function editBook(id) {
  const book = allBooks.find((item) => item.id === id);
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
}

function fillFieldsFromBookData({ title = "", author = "", genre = "" }) {
  if (title && els.title && !els.title.value.trim()) {
    els.title.value = title;
  } else if (title && els.title) {
    els.title.value = title;
  }

  if (author && els.author && !els.author.value.trim()) {
    els.author.value = author;
  } else if (author && els.author) {
    els.author.value = author;
  }

  if (genre && els.genre && !els.genre.value.trim()) {
    els.genre.value = genre;
  }
}

async function fileToImageBitmap(file) {
  if (!("createImageBitmap" in window)) return null;
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function extractIsbnFromText(text) {
  const cleaned = String(text || "")
    .replace(/[\s\-]/g, "")
    .toUpperCase();

  const match13 = cleaned.match(/97[89]\d{10}/);
  if (match13) return match13[0];

  const match10 = cleaned.match(/\b\d{9}[0-9X]\b/);
  if (match10) return match10[0];

  return null;
}

async function detectIsbnFromImage(file) {
  const bitmap = await fileToImageBitmap(file);
  if (!bitmap) return null;

  if ("BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
      });

      const codes = await detector.detect(bitmap);
      if (codes && codes.length) {
        for (const code of codes) {
          const raw = String(code.rawValue || "").replace(/[^\dXx]/g, "");
          if (/^(97[89]\d{10}|\d{9}[0-9Xx])$/.test(raw)) {
            return raw.toUpperCase();
          }
        }
      }
    } catch {
      // prosegue con OCR
    }
  }

  return null;
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;

  if (!tesseractLoaderPromise) {
    tesseractLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js";
      script.onload = () => resolve(window.Tesseract);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return tesseractLoaderPromise;
}

async function runOcr(file) {
  const Tesseract = await loadTesseract();
  const result = await Tesseract.recognize(file, "ita+eng");
  return result?.data?.text || "";
}

function parseCoverText(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 1)
    .filter((line) => !/^\d+$/.test(line))
    .filter((line) => !/^isbn/i.test(line))
    .filter((line) => !/^ediz/i.test(line))
    .filter((line) => !/^volume/i.test(line));

  if (!lines.length) {
    return { title: "", author: "" };
  }

  const shortUseful = lines.filter((line) => line.length <= 80);

  const title = shortUseful[0] || lines[0] || "";
  let author = "";

  if (shortUseful.length > 1) {
    author = shortUseful[1];
  }

  if (/di\s+/i.test(author)) {
    author = author.replace(/^di\s+/i, "").trim();
  }

  return { title, author };
}

async function lookupBookByIsbn(isbn) {
  const url = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const doc = data.docs?.[0];
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
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const doc = data.docs?.[0];
  if (!doc) return null;

  return {
    title: doc.title || title || "",
    author: doc.author_name?.[0] || author || "",
    genre: doc.subject?.[0] || ""
  };
}

async function handleScanFile(file) {
  if (!file) return;

  clearMessage();
  setScanStatus("Analisi immagine in corso...");

  const previewUrl = URL.createObjectURL(file);
  if (els.scanPreview) {
    els.scanPreview.src = previewUrl;
  }
  if (els.scanPreviewWrapper) {
    els.scanPreviewWrapper.classList.remove("hidden");
  }

  try {
    setScanStatus("Provo a leggere il codice ISBN...");
    let isbn = await detectIsbnFromImage(file);

    if (!isbn) {
      setScanStatus("ISBN non trovato. Provo con OCR sulla foto...");
      const ocrText = await runOcr(file);

      isbn = extractIsbnFromText(ocrText);
      if (isbn) {
        setScanStatus(`ISBN trovato via OCR: ${isbn}. Recupero i dati...`);
      } else {
        setScanStatus("ISBN non trovato. Provo a leggere titolo e autore dalla copertina...");
        const guessed = parseCoverText(ocrText);
        let found = null;

        if (guessed.title || guessed.author) {
          found = await lookupBookByTitleAuthor(guessed.title, guessed.author);
        }

        if (found) {
          fillFieldsFromBookData(found);
          setScanStatus("Copertina letta. Controlla i campi e correggi se serve.");
          showMessage("Dati letti dalla copertina. Verifica prima di salvare.", "success");
          return;
        }

        fillFieldsFromBookData(guessed);
        setScanStatus("Ho letto qualcosa dalla copertina, ma non sono sicuro. Controlla i campi.");
        showMessage("Riconoscimento copertina parziale. Controlla e correggi i campi.", "info");
        return;
      }
    }

    const foundByIsbn = await lookupBookByIsbn(isbn);

    if (foundByIsbn) {
      fillFieldsFromBookData(foundByIsbn);
      setScanStatus(`ISBN trovato (${isbn}). Campi compilati automaticamente.`);
      showMessage("Libro riconosciuto da ISBN. Controlla i campi e salva.", "success");
      return;
    }

    setScanStatus(`ISBN trovato (${isbn}), ma nessun risultato online. Inserisci i dati a mano.`);
    showMessage("ISBN letto, ma non ho trovato il libro online.", "info");
  } catch (error) {
    setScanStatus("Errore durante la scansione.");
    showMessage(error.message || "Errore durante la scansione del libro.", "error");
  }
}

function bootstrap() {
  loadFilters();
  hideBooks();
  clearScanArea();

  if (els.pageSizeSelect) {
    pageSize = Number(els.pageSizeSelect.value) || 20;
  }

  if (els.sortSelect) {
    currentSort = els.sortSelect.value || "recent";
  }

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

  document.getElementById("hideBooksBtn")?.addEventListener("click", hideBooks);

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
    const editId = event.target.getAttribute("data-edit");
    const deleteId = event.target.getAttribute("data-delete");

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
    const file = event.target.files?.[0];
    if (file) {
      await handleScanFile(file);
    }
  });

  fetchBooks();
}

bootstrap();
