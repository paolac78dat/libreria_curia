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
  fNotes: document.getElementById("fNotes")
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

function bootstrap() {
  loadFilters();
  hideBooks();

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

  fetchBooks();
}

bootstrap();
