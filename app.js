const board = document.getElementById("board");
const addColumnBtn = document.getElementById("add-column");
const columnDialog = document.getElementById("column-dialog");
const columnForm = document.getElementById("column-form");
const cardDialog = document.getElementById("card-dialog");
const cardForm = document.getElementById("card-form");
const boardTitleInput = document.getElementById("board-title");
const openTimelineBtn = document.getElementById("open-timeline");
const timelineDialog = document.getElementById("timeline-dialog");
const timelineContainer = document.getElementById("timeline");
const authForm = document.getElementById("auth-form");
const signUpBtn = document.getElementById("sign-up");
const signInBtn = document.getElementById("sign-in");
const authStatus = document.getElementById("auth-status");
const boardOpenForm = document.getElementById("board-open-form");
const boardOpenBtn = document.getElementById("board-open");
const boardOpenStatus = document.getElementById("board-open-status");
const boardCreateForm = document.getElementById("board-create-form");
const boardCreateBtn = document.getElementById("board-create");
const boardCreateStatus = document.getElementById("board-create-status");

const supabaseUrl = "https://okmhfegiaonqgfqykuzm.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbWhmZWdpYW9ucWdmcXlrdXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzkzMTcsImV4cCI6MjA4NTg1NTMxN30.TpugZBoaWNHwN7ekLMXWREQ6o6DcpK7SzGEAvkGSzps";
const supabase = window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

async function signUp(email, password) {
  if (!supabase) {
    return { error: { message: "Supabase is niet geladen." } };
  }
  const result = await supabase.auth.signUp({ email, password });
  console.log("signUp:", result);
  return result;
}

async function signIn(email, password) {
  if (!supabase) {
    return { error: { message: "Supabase is niet geladen." } };
  }
  const result = await supabase.auth.signInWithPassword({ email, password });
  console.log("signIn:", result);
  return result;
}

const STORAGE_KEY = "kanban-board-v2";

const defaultState = {
  title: "Kanban Bord",
  columns: [
    {
      id: createId(),
      title: "Te doen",
      cards: [
        {
          id: createId(),
          title: "Project opstarten",
          description: "Maak de eerste kolommen en kaartjes aan.",
          date: new Date().toISOString().slice(0, 10)
        }
      ]
    },
    {
      id: createId(),
      title: "Bezig",
      cards: []
    },
    {
      id: createId(),
      title: "Gedaan",
      cards: []
    }
  ]
};

let state = loadState();
let activeDrag = null;
let currentBoard = null;
let pendingSave = null;

function createId() {
  return `id-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultState);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  if (currentBoard) {
    scheduleRemoteSave();
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function render() {
  board.innerHTML = "";
  boardTitleInput.value = state.title || "Kanban Bord";
  state.columns.forEach((column) => {
    const columnEl = document.createElement("section");
    columnEl.className = "column";
    columnEl.dataset.columnId = column.id;

    columnEl.innerHTML = `
      <div class="column-header">
        <input
          class="column-title-input"
          type="text"
          maxlength="40"
          value="${escapeHtml(column.title)}"
          aria-label="Kolomtitel"
        />
        <span class="column-count">${column.cards.length}</span>
      </div>
      <div class="card-list" aria-label="Kaartjes voor ${escapeHtml(column.title)}"></div>
      <div class="column-footer">
        <button class="add-card" type="button">+ Kaartje toevoegen</button>
      </div>
    `;

    const list = columnEl.querySelector(".card-list");
    const titleInput = columnEl.querySelector(".column-title-input");

    titleInput.addEventListener("input", () => {
      const nextTitle = titleInput.value.trim() || "Kolom";
      column.title = nextTitle;
      list.setAttribute("aria-label", `Kaartjes voor ${nextTitle}`);
      saveState();
    });
    column.cards.forEach((card) => {
      list.appendChild(renderCard(card));
    });

    list.addEventListener("dragover", (event) => {
      event.preventDefault();
      list.classList.add("drag-over");
    });

    list.addEventListener("dragleave", () => {
      list.classList.remove("drag-over");
    });

    list.addEventListener("drop", (event) => {
      event.preventDefault();
      list.classList.remove("drag-over");
      if (!activeDrag) return;
      moveCard(activeDrag.cardId, activeDrag.fromColumnId, column.id);
    });

    columnEl.querySelector(".add-card").addEventListener("click", () => {
      openCardDialog(column.id);
    });

    board.appendChild(columnEl);
  });
}

function renderCard(card) {
  const cardEl = document.createElement("article");
  cardEl.className = "card";
  cardEl.draggable = true;
  cardEl.dataset.cardId = card.id;
  const dateLabel = formatDate(card.date);
  cardEl.innerHTML = `
    <h4>${escapeHtml(card.title)}</h4>
    <p>${escapeHtml(card.description)}</p>
    <span class="card-date">${escapeHtml(dateLabel)}</span>
  `;

  cardEl.addEventListener("dragstart", (event) => {
    cardEl.classList.add("dragging");
    const columnId = cardEl.closest(".column").dataset.columnId;
    activeDrag = { cardId: card.id, fromColumnId: columnId };
    event.dataTransfer.effectAllowed = "move";
  });

  cardEl.addEventListener("dragend", () => {
    cardEl.classList.remove("dragging");
    activeDrag = null;
  });

  return cardEl;
}

function moveCard(cardId, fromColumnId, toColumnId) {
  if (fromColumnId === toColumnId) {
    return;
  }
  const fromColumn = state.columns.find((col) => col.id === fromColumnId);
  const toColumn = state.columns.find((col) => col.id === toColumnId);
  if (!fromColumn || !toColumn) return;

  const cardIndex = fromColumn.cards.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) return;

  const [card] = fromColumn.cards.splice(cardIndex, 1);
  toColumn.cards.push(card);
  saveState();
  render();
}

function openCardDialog(columnId) {
  cardForm.reset();
  cardForm.columnId.value = columnId;
  cardForm.date.value = new Date().toISOString().slice(0, 10);
  cardDialog.showModal();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char];
  });
}

function formatDate(value) {
  if (!value) return "Geen datum";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function renderTimeline() {
  const items = state.columns.flatMap((column) =>
    column.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      date: card.date,
      columnTitle: column.title
    }))
  );

  items.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    return timeA - timeB;
  });

  timelineContainer.innerHTML = "";
  if (items.length === 0) {
    timelineContainer.innerHTML = `<p class="muted">Nog geen kaartjes.</p>`;
    return;
  }

  items.forEach((item) => {
    const element = document.createElement("div");
    element.className = "timeline-item";
    element.innerHTML = `
      <span class="timeline-marker"></span>
      <div class="timeline-content">
        <h4>${escapeHtml(item.title)}</h4>
        <p>${escapeHtml(item.columnTitle)}</p>
        <span class="timeline-date">${escapeHtml(formatDate(item.date))}</span>
      </div>
    `;
    timelineContainer.appendChild(element);
  });
}

addColumnBtn.addEventListener("click", () => {
  columnForm.reset();
  columnDialog.showModal();
});

columnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(columnForm);
  const title = formData.get("title").toString().trim();
  if (!title) return;

  state.columns.push({
    id: createId(),
    title,
    cards: []
  });
  saveState();
  render();
  columnDialog.close();
});

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(cardForm);
  const title = formData.get("title").toString().trim();
  const description = formData.get("description").toString().trim();
  const date = formData.get("date").toString().trim();
  const columnId = formData.get("columnId").toString();
  if (!title || !description || !date) return;

  const column = state.columns.find((col) => col.id === columnId);
  if (!column) return;

  column.cards.push({
    id: createId(),
    title,
    description,
    date
  });
  saveState();
  render();
  cardDialog.close();
});

boardTitleInput.addEventListener("input", () => {
  state.title = boardTitleInput.value.trim() || "Kanban Bord";
  saveState();
});

openTimelineBtn.addEventListener("click", () => {
  renderTimeline();
  timelineDialog.showModal();
});

async function handleAuth(action) {
  const formData = new FormData(authForm);
  const email = formData.get("email").toString().trim();
  const password = formData.get("password").toString().trim();
  if (!email || !password) {
    authStatus.textContent = "Vul een email en wachtwoord in.";
    return;
  }

  authStatus.textContent = "Bezig...";
  try {
    const result = action === "signup"
      ? await signUp(email, password)
      : await signIn(email, password);
    if (result.error) {
      authStatus.textContent = result.error.message;
    } else {
      authStatus.textContent = "Gelukt. Check de console voor details.";
    }
  } catch (error) {
    authStatus.textContent = "Er ging iets mis bij het inloggen.";
  }
}

signUpBtn.addEventListener("click", () => handleAuth("signup"));
signInBtn.addEventListener("click", () => handleAuth("signin"));

async function ensureSignedIn() {
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getUser();
  return data.user;
}

function getInitialBoardData(title) {
  return {
    title,
    columns: [
      { id: createId(), title: "Te doen", cards: [] },
      { id: createId(), title: "Bezig", cards: [] },
      { id: createId(), title: "Gedaan", cards: [] }
    ]
  };
}

async function createBoard() {
  if (!supabase) {
    boardCreateStatus.textContent = "Supabase is niet geladen.";
    return;
  }
  const formData = new FormData(boardCreateForm);
  const title = formData.get("title").toString().trim();
  const slug = formData.get("slug").toString().trim();
  const password = formData.get("password").toString().trim();
  if (!title || !slug || !password) {
    boardCreateStatus.textContent = "Vul alle velden in.";
    return;
  }

  boardCreateStatus.textContent = "Bezig...";
  const user = await ensureSignedIn();
  if (!user) {
    boardCreateStatus.textContent = "Log eerst in met het masteraccount.";
    return;
  }

  const boardData = getInitialBoardData(title);
  const { error } = await supabase.rpc("create_board", {
    board_title: title,
    board_slug: slug,
    board_password: password,
    board_data: boardData
  });

  if (error) {
    boardCreateStatus.textContent = error.message;
    return;
  }

  boardCreateStatus.textContent = "Board gemaakt. Je kunt het nu openen.";
  boardOpenForm.slug.value = slug;
}

async function openBoard() {
  if (!supabase) {
    boardOpenStatus.textContent = "Supabase is niet geladen.";
    return;
  }
  const formData = new FormData(boardOpenForm);
  const slug = formData.get("slug").toString().trim();
  const password = formData.get("password").toString().trim();
  if (!slug || !password) {
    boardOpenStatus.textContent = "Vul een slug en wachtwoord in.";
    return;
  }

  boardOpenStatus.textContent = "Bezig...";
  const { data, error } = await supabase.rpc("get_board", {
    board_slug: slug,
    board_password: password
  });

  if (error) {
    boardOpenStatus.textContent = error.message;
    return;
  }

  if (!data) {
    boardOpenStatus.textContent = "Board niet gevonden.";
    return;
  }

  currentBoard = { slug, password };
  state = data;
  saveState();
  render();
  boardOpenStatus.textContent = "Board geopend.";
  const url = new URL(window.location.href);
  url.searchParams.set("board", slug);
  window.history.replaceState({}, "", url);
}

function scheduleRemoteSave() {
  if (!currentBoard) return;
  if (!supabase) return;
  if (pendingSave) {
    window.clearTimeout(pendingSave);
  }
  pendingSave = window.setTimeout(async () => {
    const { error } = await supabase.rpc("save_board", {
      board_slug: currentBoard.slug,
      board_password: currentBoard.password,
      board_title: state.title,
      board_data: state
    });
    if (error) {
      boardOpenStatus.textContent = "Opslaan mislukt: " + error.message;
    }
  }, 600);
}

boardCreateBtn.addEventListener("click", createBoard);
boardOpenBtn.addEventListener("click", openBoard);
boardCreateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createBoard();
});
boardOpenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  openBoard();
});

function prefillFromUrl() {
  const url = new URL(window.location.href);
  const slug = url.searchParams.get("board");
  if (slug) {
    boardOpenForm.slug.value = slug;
  }
}

prefillFromUrl();

if (!supabase) {
  authStatus.textContent =
    "Supabase kon niet laden. Gebruik een lokale server i.p.v. file://.";
  boardOpenStatus.textContent =
    "Supabase is niet beschikbaar.";
  boardCreateStatus.textContent =
    "Supabase is niet beschikbaar.";
  signUpBtn.disabled = true;
  signInBtn.disabled = true;
  boardOpenBtn.disabled = true;
  boardCreateBtn.disabled = true;
}

render();
