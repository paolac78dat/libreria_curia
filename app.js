let allBooks = [];
let editingBookId = null;
let booksVisible = false;

const els = {
  messageBox: document.getElementById("messageBox"),
  books: document.getElementById("books"),
  booksWrapper: document.getElementById("booksWrapper"),
  resultsCount: document.getElementById("resultsCount"),

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
  hideBooks();
  if (els.resultsCount) els.resultsCount.textContent = "0 libri";
}

function clearForm() {
  editingBookId = null;
  if (els.title) els.title.value = "";
  if (els.author) els.author.value = "";
  if (els.genre) els.genre.value = "";
  if (els.status) els.status.value = "Da leggere";
  if (els.notes) els.notes.value = "";
}

function getStatusClass(status) {
  return `status-${String(status || "Da leggere").replaceAll(" ", "-")}`;
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
  const filtered = applyClientFilters(data || []);

 if (els.resultsCount) {
  const count = filtered.length;
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

  if (!filtered.length) {
    els.books.innerHTML = `
      <div class="empty-state">
        Nessun libro trovato.
      </div>
    `;
    return;
  }

  els.books.innerHTML = filtered
    .map((book) => {
      return `
        <article class="book-card">
          <div class="book-body">
            <h3>${sanitize(book.title || "Senza titolo")}</h3>
            <p class="book-meta">${sanitize(book.author || "Autore non indicato")}</p>
            <div class="badges">
              <span class="badge ${getStatusClass(book.status)}">${sanitize(book.status || "Da leggere")}</span>
              ${book.genre ? `<span class="badge">${sanitize(book.genre)}</span>` : ""}
            </div>
            ${book.notes ? `<p>${sanitize(book.notes)}</p>` : `<p class="muted">Nessuna nota</p>`}
            <div class="book-actions">
              <button class="secondary" data-edit="${book.id}">Modifica</button>
              <button class="danger" data-delete="${book.id}">Elimina</button>
            </div>
          </div>
        </article>
      `;
    })
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
  showMessage(editingBookId ? "Libro aggiornato." : "Libro salvato.", "success");
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

  document.getElementById("saveBookBtn")?.addEventListener("click", saveBook);
  document.getElementById("clearFormBtn")?.addEventListener("click", clearForm);
  document.getElementById("refreshBtn")?.addEventListener("click", fetchBooks);
  document.getElementById("applyFiltersBtn")?.addEventListener("click", () => {
    showBooks();
    renderBooks(allBooks);
  });
  document.getElementById("resetFiltersBtn")?.addEventListener("click", resetFilters);
  document.getElementById("showBooksBtn")?.addEventListener("click", () => {
    showBooks();
    renderBooks(allBooks);
  });
  document.getElementById("hideBooksBtn")?.addEventListener("click", hideBooks);

  filterKeys.forEach((key) => {
    els[key]?.addEventListener("input", () => {
      if (hasActiveFilters()) {
        showBooks();
      }
      renderBooks(allBooks);
    });
    els[key]?.addEventListener("change", () => {
      if (hasActiveFilters()) {
        showBooks();
      }
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
