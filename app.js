const board = document.getElementById("board");
const addCardBtn = document.getElementById("add-card");
const cardDialog = document.getElementById("card-dialog");
const cardForm = document.getElementById("card-form");
const cardDialogTitle = document.getElementById("card-dialog-title");
const cardSubmitBtn = document.getElementById("card-submit");
const boardTitleInput = document.getElementById("board-title");
const boardTopbar = document.getElementById("board-topbar");
const openTimelineBtn = document.getElementById("open-timeline");
const timelineDialog = document.getElementById("timeline-dialog");
const timelineContainer = document.getElementById("timeline");
const inbox = document.getElementById("inbox");
const timelineBoard = document.querySelector(".timeline-board");
const timelinePath = document.getElementById("timeline-path");
const authForm = document.getElementById("auth-form");
const signUpBtn = document.getElementById("sign-up");
const signInBtn = document.getElementById("sign-in");
const authStatus = document.getElementById("auth-status");
const loginScreen = document.getElementById("login-screen");
const boardsScreen = document.getElementById("boards-screen");
const boardScreen = document.getElementById("board-screen");
const boardsGrid = document.getElementById("boards-grid");
const boardsStatus = document.getElementById("boards-status");
const openCreateBoardBtn = document.getElementById("open-create-board");
const logoutBtn = document.getElementById("logout");
const createBoardDialog = document.getElementById("create-board-dialog");
const boardCreateForm = document.getElementById("board-create-form");
const boardCreateBtn = document.getElementById("board-create");
const boardCreateStatus = document.getElementById("board-create-status");
const boardPasswordBtn = document.getElementById("board-password");
const backToBoardsBtn = document.getElementById("back-to-boards");
const copyLinkBtn = document.getElementById("copy-link");
const passwordDialog = document.getElementById("password-dialog");
const passwordForm = document.getElementById("password-form");
const passwordSaveBtn = document.getElementById("password-save");
const passwordStatus = document.getElementById("password-status");
const accessDialog = document.getElementById("access-dialog");
const accessForm = document.getElementById("access-form");
const accessOpenBtn = document.getElementById("access-open");
const accessStatus = document.getElementById("access-status");

document.querySelectorAll(".dialog-cancel").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    button.closest("dialog").close();
  });
});

document.querySelectorAll(".dialog-close").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    button.closest("dialog").close();
  });
});

const supabaseUrl = "https://okmhfegiaonqgfqykuzm.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbWhmZWdpYW9ucWdmcXlrdXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzkzMTcsImV4cCI6MjA4NTg1NTMxN30.TpugZBoaWNHwN7ekLMXWREQ6o6DcpK7SzGEAvkGSzps";
const supabaseClient = window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

async function signUp(email, password) {
  if (!supabaseClient) {
    return { error: { message: "Supabase is niet geladen." } };
  }
  const result = await supabaseClient.auth.signUp({ email, password });
  console.log("signUp:", result);
  return result;
}

async function signIn(email, password) {
  if (!supabaseClient) {
    return { error: { message: "Supabase is niet geladen." } };
  }
  const result = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });
  console.log("signIn:", result);
  return result;
}

const STORAGE_KEY = "kanban-board-v2";

const defaultState = {
  title: "Kanban Bord",
  inbox: [],
  cards: [
    {
      id: createId(),
      title: "Project opstarten",
      description: "Maak de eerste kaarten op de tijdlijn.",
      date: new Date().toISOString().slice(0, 10)
    }
  ]
};

let state = loadState();
let activeDrag = null;
let currentBoard = null;
let pendingSave = null;
let editingCardId = null;

function createId() {
  return `id-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultState);
  }
  try {
    const parsed = JSON.parse(raw);
    return migrateState(parsed);
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function migrateState(parsed) {
  if (parsed.cards && parsed.inbox) return parsed;
  if (parsed.cards) {
    return {
      title: parsed.title || "Kanban Bord",
      cards: parsed.cards,
      inbox: []
    };
  }
  if (!parsed.columns) return structuredClone(defaultState);
  const cards = parsed.columns.flatMap((column) =>
    column.cards.map((card) => ({
      ...card,
      columnTitle: column.title
    }))
  );
  return {
    title: parsed.title || "Kanban Bord",
    cards,
    inbox: []
  };
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
  inbox.innerHTML = "";
  boardTitleInput.value = state.title || "Kanban Bord";
  state.inbox.forEach((card) => {
    inbox.appendChild(renderTimelineCard(card, "inbox"));
  });
  const sortedCards = sortCardsByDate(state.cards);
  sortedCards.forEach((card, index) => {
    board.appendChild(renderTimelineCard(card, "timeline", index));
  });

  board.addEventListener("dragover", (event) => {
    event.preventDefault();
    board.classList.add("drag-over");
  });

  board.addEventListener("dragleave", () => {
    board.classList.remove("drag-over");
  });

  board.addEventListener("drop", (event) => {
    event.preventDefault();
    board.classList.remove("drag-over");
    if (!activeDrag) return;
    if (activeDrag.source === "inbox") {
      moveFromInboxToTimeline(activeDrag.cardId);
    }
  });

  inbox.addEventListener("dragover", (event) => {
    event.preventDefault();
    inbox.classList.add("drag-over");
  });

  inbox.addEventListener("dragleave", () => {
    inbox.classList.remove("drag-over");
  });

  inbox.addEventListener("drop", (event) => {
    event.preventDefault();
    inbox.classList.remove("drag-over");
    if (!activeDrag) return;
    if (activeDrag.source === "timeline") {
      moveFromTimelineToInbox(activeDrag.cardId);
    }
  });

  scheduleTimelinePathUpdate();
}

function renderTimelineCard(card, source, index = 0) {
  const wrapper = document.createElement("div");
  wrapper.className = "timeline-item";
  wrapper.dataset.cardId = card.id;
  if (source === "timeline") {
    const row = Math.floor(index / 5) + 1;
    const pos = index % 5;
    const col = row % 2 === 1 ? pos + 1 : 5 - pos;
    wrapper.style.gridRow = String(row);
    wrapper.style.gridColumn = String(col);
  }
  const dateLabel = formatDate(card.date);
  wrapper.innerHTML = `
    <span class="timeline-marker"></span>
    <article class="card" draggable="true">
      <h4>${escapeHtml(card.title)}</h4>
      <p>${escapeHtml(card.description)}</p>
      <span class="card-date">${escapeHtml(dateLabel)}</span>
    </article>
  `;

  const cardEl = wrapper.querySelector(".card");
  cardEl.addEventListener("dragstart", (event) => {
    cardEl.classList.add("dragging");
    activeDrag = { cardId: card.id, source };
    event.dataTransfer.effectAllowed = "move";
  });

  cardEl.addEventListener("dragend", () => {
    cardEl.classList.remove("dragging");
    activeDrag = null;
  });

  cardEl.addEventListener("click", () => {
    openCardDialog(card);
  });

  return wrapper;
}

function updateTimelinePath() {
  if (!timelinePath || !timelineBoard) return;
  const markers = board.querySelectorAll(".timeline-item .timeline-marker");
  const boardRect = timelineBoard.getBoundingClientRect();
  const points = Array.from(markers).map((marker) => {
    const rect = marker.getBoundingClientRect();
    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2
    };
  });

  if (points.length === 0) {
    timelinePath.innerHTML = "";
    return;
  }

  const d = points
    .map((point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
    )
    .join(" ");

  timelinePath.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
  timelinePath.innerHTML = `<path d="${d}" />`;
}

let timelinePathRaf = null;
function scheduleTimelinePathUpdate() {
  if (timelinePathRaf) {
    cancelAnimationFrame(timelinePathRaf);
  }
  timelinePathRaf = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateTimelinePath();
      timelinePathRaf = null;
    });
  });
}

window.addEventListener("resize", () => {
  scheduleTimelinePathUpdate();
});

window.addEventListener("load", () => {
  scheduleTimelinePathUpdate();
});

function moveFromInboxToTimeline(cardId) {
  const fromIndex = state.inbox.findIndex((card) => card.id === cardId);
  if (fromIndex === -1) return;
  const [card] = state.inbox.splice(fromIndex, 1);
  state.cards.push(card);
  saveState();
  render();
}

function moveFromTimelineToInbox(cardId) {
  const fromIndex = state.cards.findIndex((card) => card.id === cardId);
  if (fromIndex === -1) return;
  const [card] = state.cards.splice(fromIndex, 1);
  state.inbox.push(card);
  saveState();
  render();
}

function openCardDialog(card) {
  cardForm.reset();
  cardForm.date.value = new Date().toISOString().slice(0, 10);
  editingCardId = null;
  cardDialogTitle.textContent = "Nieuw kaartje";
  cardSubmitBtn.textContent = "Aanmaken";
  if (card) {
    cardForm.title.value = card.title || "";
    cardForm.description.value = card.description || "";
    cardForm.date.value = card.date || new Date().toISOString().slice(0, 10);
    editingCardId = card.id;
    cardDialogTitle.textContent = "Kaartje bewerken";
    cardSubmitBtn.textContent = "Opslaan";
  }
  cardDialog.showModal();
}

function sortCardsByDate(cards) {
  return [...cards].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA === timeB) {
      return (a.title || "").localeCompare(b.title || "");
    }
    return timeA - timeB;
  });
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
  const items = state.cards.map((card) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    date: card.date
  }));

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
        <span class="timeline-date">${escapeHtml(formatDate(item.date))}</span>
      </div>
    `;
    timelineContainer.appendChild(element);
  });
}

addCardBtn.addEventListener("click", () => {
  openCardDialog();
});

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(cardForm);
  const title = formData.get("title").toString().trim();
  const description = formData.get("description").toString().trim();
  const date = formData.get("date").toString().trim();
  if (!title || !description || !date) return;

  if (editingCardId) {
    const list = [...state.cards, ...state.inbox];
    const card = list.find((item) => item.id === editingCardId);
    if (card) {
      card.title = title;
      card.description = description;
      card.date = date;
    }
  } else {
    state.inbox.push({
      id: createId(),
      title,
      description,
      date
    });
  }
  saveState();
  render();
  cardDialog.close();
});

boardTitleInput.addEventListener("input", () => {
  state.title = boardTitleInput.value.trim() || "Kanban Bord";
  saveState();
});

if (openTimelineBtn) {
  openTimelineBtn.addEventListener("click", () => {
    renderTimeline();
    timelineDialog.showModal();
  });
}

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
      authStatus.textContent = "Gelukt.";
      await initAuth();
    }
  } catch (error) {
    authStatus.textContent = "Er ging iets mis bij het inloggen.";
  }
}

signUpBtn.addEventListener("click", () => handleAuth("signup"));
signInBtn.addEventListener("click", () => handleAuth("signin"));

async function ensureSignedIn() {
  if (!supabaseClient) {
    return null;
  }
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.user ?? null;
}

function getInitialBoardData(title) {
  return {
    title,
    cards: []
  };
}

async function createBoard() {
  if (!supabaseClient) {
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
  const { error } = await supabaseClient.rpc("create_board", {
    board_title: title,
    board_slug: slug,
    board_password: password,
    board_data: boardData
  });

  if (error) {
    boardCreateStatus.textContent = error.message;
    return;
  }

  boardCreateStatus.textContent = "Board gemaakt.";
  createBoardDialog.close();
  await loadBoards();
}

async function openBoard(slug) {
  if (!supabaseClient) {
    boardsStatus.textContent = "Supabase is niet geladen.";
    return;
  }
  boardsStatus.textContent = "Board openen...";
  const { data, error } = await supabaseClient.rpc("get_board_owner", {
    board_slug: slug
  });

  if (error) {
    boardsStatus.textContent = error.message;
    return;
  }
  if (!data) {
    boardsStatus.textContent = "Board niet gevonden.";
    return;
  }

  currentBoard = { slug, mode: "owner" };
  state = migrateState(data || {});
  render();
  showBoardScreen();
  boardsStatus.textContent = "";
}

async function openBoardWithPassword(slug, password) {
  if (!supabaseClient) {
    accessStatus.textContent = "Supabase is niet geladen.";
    return;
  }
  accessStatus.textContent = "Board openen...";
  const { data, error } = await supabaseClient.rpc("get_board", {
    board_slug: slug,
    board_password: password
  });
  if (error) {
    accessStatus.textContent = error.message;
    return;
  }
  if (!data) {
    accessStatus.textContent = "Board niet gevonden of wachtwoord onjuist.";
    return;
  }
  currentBoard = { slug, mode: "public", password };
  state = migrateState(data || {});
  render();
  showBoardScreen();
  accessStatus.textContent = "";
  accessDialog.close();
}

function scheduleRemoteSave() {
  if (!currentBoard) return;
  if (!supabaseClient) return;
  if (pendingSave) {
    window.clearTimeout(pendingSave);
  }
  pendingSave = window.setTimeout(async () => {
    const { error } = await supabaseClient.rpc(
      currentBoard.mode === "owner" ? "save_board_owner" : "save_board",
      currentBoard.mode === "owner"
        ? {
            board_slug: currentBoard.slug,
            board_title: state.title,
            board_data: state
          }
        : {
            board_slug: currentBoard.slug,
            board_password: currentBoard.password,
            board_title: state.title,
            board_data: state
          }
    );
    if (error) {
      boardsStatus.textContent = "Opslaan mislukt: " + error.message;
    }
  }, 600);
}

boardCreateBtn.addEventListener("click", createBoard);
boardCreateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createBoard();
});

openCreateBoardBtn.addEventListener("click", () => {
  boardCreateStatus.textContent = "";
  boardCreateForm.reset();
  createBoardDialog.showModal();
});

logoutBtn.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  showLoginScreen();
});

boardPasswordBtn.addEventListener("click", () => {
  if (!currentBoard) return;
  passwordStatus.textContent = "";
  passwordForm.reset();
  passwordDialog.showModal();
});

backToBoardsBtn.addEventListener("click", () => {
  showBoardsScreen();
  loadBoards();
});

copyLinkBtn.addEventListener("click", async () => {
  const url = getBoardUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    copyLinkBtn.textContent = "Gekopieerd!";
    window.setTimeout(() => {
      copyLinkBtn.textContent = "Kopieer link";
    }, 1500);
  } catch (error) {
    copyLinkBtn.textContent = "Kopiëren mislukt";
    window.setTimeout(() => {
      copyLinkBtn.textContent = "Kopieer link";
    }, 1500);
  }
});

passwordSaveBtn.addEventListener("click", (event) => {
  event.preventDefault();
  updateBoardPassword();
});

passwordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateBoardPassword();
});

accessOpenBtn.addEventListener("click", (event) => {
  event.preventDefault();
  handleAccessSubmit();
});

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleAccessSubmit();
});

async function loadBoards() {
  if (!supabaseClient) return;
  boardsStatus.textContent = "Boards laden...";
  const { data, error } = await supabaseClient.rpc("list_boards");
  if (error) {
    boardsStatus.textContent = error.message;
    return;
  }
  boardsGrid.innerHTML = "";
  const newCard = document.createElement("div");
  newCard.className = "board-card new";
  newCard.innerHTML = `
    <span>+</span>
    <p>Nieuw bord</p>
  `;
  newCard.addEventListener("click", () => openCreateBoardBtn.click());
  boardsGrid.appendChild(newCard);

  data.forEach((boardItem) => {
    const card = document.createElement("div");
    card.className = "board-card";
    card.innerHTML = `
      <button class="board-delete" type="button">Verwijderen</button>
      <h3>${escapeHtml(boardItem.title)}</h3>
      <p>${escapeHtml(boardItem.slug)}</p>
    `;
    card.addEventListener("click", () => openBoard(boardItem.slug));
    const deleteBtn = card.querySelector(".board-delete");
    deleteBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!confirm(`Board "${boardItem.title}" verwijderen?`)) return;
      const { error: deleteError } = await supabaseClient.rpc("delete_board", {
        board_slug: boardItem.slug
      });
      if (deleteError) {
        boardsStatus.textContent = deleteError.message;
        return;
      }
      loadBoards();
    });
    boardsGrid.appendChild(card);
  });
  boardsStatus.textContent = "";
}

function showLoginScreen() {
  loginScreen.classList.remove("hidden");
  boardsScreen.classList.add("hidden");
  boardScreen.classList.add("hidden");
  boardTopbar.classList.add("hidden");
}

function showBoardsScreen() {
  loginScreen.classList.add("hidden");
  boardsScreen.classList.remove("hidden");
  boardScreen.classList.add("hidden");
  boardTopbar.classList.add("hidden");
}

function showBoardScreen() {
  loginScreen.classList.add("hidden");
  boardsScreen.classList.add("hidden");
  boardScreen.classList.remove("hidden");
  boardTopbar.classList.remove("hidden");
  updateOwnerControls();
}

function updateOwnerControls() {
  const isOwner = currentBoard?.mode === "owner";
  boardPasswordBtn.classList.toggle("hidden", !isOwner);
  backToBoardsBtn.classList.toggle("hidden", !isOwner);
  copyLinkBtn.classList.toggle("hidden", !isOwner);
}

function getBoardUrl() {
  if (!currentBoard?.slug) return "";
  const url = new URL(window.location.href);
  url.searchParams.set("board", currentBoard.slug);
  return url.toString();
}


async function initAuth() {
  if (!supabaseClient) return;
  const user = await ensureSignedIn();
  if (user) {
    showBoardsScreen();
    await loadBoards();
    return;
  }
  const url = new URL(window.location.href);
  const slug = url.searchParams.get("board");
  if (slug) {
    showLoginScreen();
    accessForm.dataset.slug = slug;
    accessStatus.textContent = "";
    accessForm.reset();
    accessDialog.showModal();
    return;
  }
  showLoginScreen();
}

function handleAccessSubmit() {
  const slug = accessForm.dataset.slug;
  const formData = new FormData(accessForm);
  const password = formData.get("password").toString().trim();
  if (!slug || !password) {
    accessStatus.textContent = "Vul het wachtwoord in.";
    return;
  }
  openBoardWithPassword(slug, password);
}

async function updateBoardPassword() {
  if (!supabaseClient) return;
  if (!currentBoard) return;
  const formData = new FormData(passwordForm);
  const password = formData.get("password").toString().trim();
  if (!password) {
    passwordStatus.textContent = "Vul een wachtwoord in.";
    return;
  }
  passwordStatus.textContent = "Opslaan...";
  const { error } = await supabaseClient.rpc("set_board_password", {
    board_slug: currentBoard.slug,
    board_password: password
  });
  if (error) {
    passwordStatus.textContent = error.message;
    return;
  }
  passwordStatus.textContent = "Opgeslagen.";
  passwordDialog.close();
}

if (!supabaseClient) {
  authStatus.textContent =
    "Supabase kon niet laden. Gebruik een lokale server i.p.v. file://.";
  boardCreateStatus.textContent =
    "Supabase is niet beschikbaar.";
  signUpBtn.disabled = true;
  signInBtn.disabled = true;
  boardCreateBtn.disabled = true;
  openCreateBoardBtn.disabled = true;
  logoutBtn.disabled = true;
  boardPasswordBtn.disabled = true;
  backToBoardsBtn.disabled = true;
  passwordSaveBtn.disabled = true;
  accessOpenBtn.disabled = true;
  copyLinkBtn.disabled = true;
}

render();
initAuth();
