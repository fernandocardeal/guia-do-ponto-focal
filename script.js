let cardsData = [];
let currentLoadedFileName = null;

document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  setupThemeToggle();
  setupSearchFilter();
  setupStatusPopover();

  const cardForm = document.getElementById('card-form');
  if (cardForm) {
    cardForm.addEventListener('submit', handleSaveCard);
  }
});

// Carrega os dados persistidos no Local Storage
function loadFromLocalStorage() {
  const cachedData = localStorage.getItem('minsait_portal_cards');
  const cachedFileName = localStorage.getItem('minsait_portal_filename');

  if (cachedData) {
    try {
      cardsData = JSON.parse(cachedData);
      currentLoadedFileName = cachedFileName || null;
    } catch (e) {
      cardsData = [];
    }
  } else {
    cardsData = [];
  }

  updateFileInfoBar();
  renderCards();
}

// Salva no Local Storage
function saveToLocalStorage() {
  localStorage.setItem('minsait_portal_cards', JSON.stringify(cardsData));
  if (currentLoadedFileName) {
    localStorage.setItem('minsait_portal_filename', currentLoadedFileName);
  }
}

/**
 * Extrai um objeto Date a partir de qualquer formato (Número Excel ou String)
 */
function extractDateObject(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

  const strVal = String(rawValue).trim();
  const num = Number(strVal);

  // 1. Número serial do Excel (de ~1900 a 2099)
  if (!isNaN(num) && num > 10000 && num < 75000) {
    const utcDays = num - 25569;
    const dateObj = new Date(Math.round(utcDays * 86400 * 1000));
    const userOffsetMs = dateObj.getTimezoneOffset() * 60 * 1000;
    return new Date(dateObj.getTime() + userOffsetMs);
  }

  // 2. String no formato BR: DD/MM/AAAA ou DD/MM/AAAA HH:MM
  const brMatch = strVal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (brMatch) {
    const d = parseInt(brMatch[1], 10);
    const m = parseInt(brMatch[2], 10) - 1;
    const y = parseInt(brMatch[3], 10);
    const h = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
    return new Date(y, m, d, h, min);
  }

  // 3. String no formato ISO: AAAA-MM-DD
  const isoMatch = strVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
  }

  return null;
}

/**
 * Converte valor de data em texto legível limpo (sem HTML interno)
 */
function parseExcelValue(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return '';

  const parsedDate = extractDateObject(rawValue);

  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const dia = String(parsedDate.getDate()).padStart(2, '0');
    const mes = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const ano = parsedDate.getFullYear();
    const horas = String(parsedDate.getHours()).padStart(2, '0');
    const minutos = String(parsedDate.getMinutes()).padStart(2, '0');

    let formattedText = `${dia}/${mes}/${ano}`;
    if (horas !== '00' || minutos !== '00') {
      formattedText += ` ${horas}:${minutos}`;
    }

    return formattedText;
  }

  return String(rawValue).trim();
}

/**
 * Verifica se QUALQUER campo do card (legenda ou conteúdo) contém uma data igual a HOJE
 */
function checkIfCardHasTodayDate(card) {
  const today = new Date();
  const valuesToCheck = [card.legenda];

  if (typeof card.conteudo === 'object' && card.conteudo !== null) {
    Object.values(card.conteudo).forEach(val => valuesToCheck.push(val));
  }

  return valuesToCheck.some(val => {
    const d = extractDateObject(val);
    if (d && !isNaN(d.getTime())) {
      return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
    }
    return false;
  });
}

/**
 * LÊ ARQUIVO EXCEL (.XLSX / .XLS) E ADAPTA DINAMICAMENTE
 */
async function loadFromFile() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: false, raw: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

      if (rows.length < 2) return;

      const headers = rows[0];
      const parsedCards = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const titulo = parseExcelValue(row[0]);
        const legenda = parseExcelValue(row[1]);

        const conteudoObj = {};
        for (let j = 2; j < headers.length; j++) {
          const headerName = headers[j];
          if (headerName) {
            conteudoObj[headerName] = parseExcelValue(row[j]);
          }
        }

        parsedCards.push({
          id: `card-${Date.now()}-${i}`,
          titulo: titulo,
          legenda: legenda,
          conteudo: conteudoObj
        });
      }

      cardsData = parsedCards;
      currentLoadedFileName = file.name;

      saveToLocalStorage();
      updateFileInfoBar();
      renderCards();
      showSection('section-visualizar');
    };

    input.click();
  } catch (err) {
    console.error('Erro ao ler o arquivo Excel:', err);
  }
}

/**
 * GERA E SALVA A PLANILHA EXCEL (.XLSX)
 */
function saveToFile() {
  if (!cardsData || cardsData.length === 0) return;

  try {
    const dynamicKeysSet = new Set();
    cardsData.forEach(card => {
      if (typeof card.conteudo === 'object' && card.conteudo !== null) {
        Object.keys(card.conteudo).forEach(key => dynamicKeysSet.add(key));
      }
    });

    const dynamicKeys = Array.from(dynamicKeysSet);
    const headers = ['Título', 'Legenda', ...dynamicKeys];
    const excelRows = [headers];

    cardsData.forEach(card => {
      const row = [card.titulo || '', card.legenda || ''];

      dynamicKeys.forEach(key => {
        let val = '';
        if (typeof card.conteudo === 'object' && card.conteudo !== null) {
          val = card.conteudo[key] || '';
        }
        row.push(val);
      });

      excelRows.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cards');

    const fileName = currentLoadedFileName
      ? currentLoadedFileName.replace(/\.[^/.]+$/, "") + ".xlsx"
      : "cards_portal.xlsx";

    XLSX.writeFile(workbook, fileName);
  } catch (err) {
    console.error('Erro ao salvar o arquivo Excel:', err);
  }
}

// Atualiza a barra do status do arquivo no menu
function updateFileInfoBar() {
  const fileInfoBar = document.getElementById('file-info-bar');
  if (!fileInfoBar) return;

  if (cardsData.length > 0) {
    fileInfoBar.innerHTML = `
      <div>
        Origem dos Dados: <strong>${currentLoadedFileName ? escapeHtml(currentLoadedFileName) : 'Local Storage'}</strong> (${cardsData.length} card(s))
        <br><span style="font-size: 0.85rem; color: #16a34a; font-weight: 600;">Sincronizado</span>
      </div>
    `;
  } else {
    fileInfoBar.innerHTML = `<span>Nenhum card carregado. Use "Abrir Excel" para carregar uma planilha.</span>`;
  }
}

// Converte o objeto de conteúdo em tabela HTML
function formatContentToTable(conteudo) {
  if (!conteudo) return '';

  let entries = [];
  if (typeof conteudo === 'object' && !Array.isArray(conteudo)) {
    entries = Object.entries(conteudo);
  }

  if (entries.length > 0) {
    let tableHtml = `
      <div class="table-container">
        <table class="content-table">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Informação</th>
            </tr>
          </thead>
          <tbody>
    `;

    entries.forEach(([key, val]) => {
      tableHtml += `
        <tr>
          <td class="table-key">${escapeHtml(key)}</td>
          <td class="table-val">${escapeHtml(String(val))}</td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </div>
    `;
    return tableHtml;
  }

  return `<p class="formatted-paragraph">${escapeHtml(String(conteudo)).replace(/\n/g, '<br>')}</p>`;
}

// Renderiza a lista de cards e as páginas detalhadas
function renderCards() {
  const gridContainer = document.getElementById('main-grid');
  const pagesContainer = document.getElementById('pages-container');

  if (!gridContainer || !pagesContainer) return;

  gridContainer.innerHTML = '';
  pagesContainer.innerHTML = '';

  if (cardsData.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        <h3>Sua lista de cards está vazia</h3>
        <p>Cadastre um novo card ou abra uma planilha do Excel.</p>
        <button class="btn-primary" style="max-width: 250px; margin: 1rem auto 0;" onclick="openCreateForm()">
          Cadastrar Primeiro Card
        </button>
      </div>
    `;
    updateSearchCounter(0, 0);
    return;
  }

  cardsData.forEach(card => {
    // Avalia se o card possui alguma data igual à data de hoje
    const isToday = checkIfCardHasTodayDate(card);
    const statusDotClass = isToday ? 'dot-green' : 'dot-red';
    const statusTitle = isToday ? 'Contém data de Hoje' : 'Data diferente de Hoje';

    // 1. Card na Grade Principal com Bolinha no canto superior direito
    const cardElement = document.createElement('article');
    cardElement.className = 'card';
    cardElement.setAttribute('data-card-id', card.id);
    cardElement.innerHTML = `
      <span class="card-status-dot ${statusDotClass}" title="${statusTitle}"></span>
      <div onclick="openPage('${card.id}')" style="cursor: pointer;">
        <h2>${escapeHtml(card.titulo)}</h2>
        <p>${escapeHtml(card.legenda)}</p>
      </div>
      <div class="card-footer">
        <span class="link-hint" onclick="openPage('${card.id}')">Visualizar</span>
        <div class="card-actions">
          <button class="btn-action btn-edit" onclick="openEditForm('${card.id}')">Editar</button>
          <button class="btn-action btn-delete" onclick="deleteCard('${card.id}')">Excluir</button>
        </div>
      </div>
    `;
    gridContainer.appendChild(cardElement);

    // 2. Página Detalhada
    const pageElement = document.createElement('section');
    pageElement.id = card.id;
    pageElement.className = 'content-page';
    pageElement.innerHTML = `
      <h2>${escapeHtml(card.titulo)}</h2>
      <div class="content-body">
        ${formatContentToTable(card.conteudo)}
      </div>
      
      <div class="detail-footer-actions">
        <button class="btn-back" onclick="showSection('section-visualizar')">Voltar para a lista</button>
        <div class="card-actions">
          <button class="btn-action btn-edit" onclick="openEditForm('${card.id}')">Editar Card</button>
          <button class="btn-action btn-delete" onclick="deleteCard('${card.id}')">Excluir Card</button>
        </div>
      </div>
    `;
    pagesContainer.appendChild(pageElement);
  });

  filterCards();
}

// Adiciona uma linha de campo no formulário
function addContentRow(key = '', value = '') {
  const tbody = document.getElementById('form-table-body');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'dynamic-content-row';
  tr.innerHTML = `
    <td class="table-key">
      <input type="text" class="table-editor-input input-key" placeholder="Nome do campo" value="${escapeHtml(key)}" required>
    </td>
    <td class="table-val form-entry-cell">
      <input type="text" class="table-editor-input input-val" placeholder="Informação" value="${escapeHtml(value)}">
      <button type="button" class="btn-remove-field" onclick="removeContentRow(this)" title="Remover campo">Excluir</button>
    </td>
  `;
  tbody.appendChild(tr);
}

function removeContentRow(button) {
  const row = button.closest('tr');
  if (row) row.remove();
}

function clearDynamicRows() {
  const tbody = document.getElementById('form-table-body');
  if (!tbody) return;
  const dynamicRows = tbody.querySelectorAll('.dynamic-content-row');
  dynamicRows.forEach(row => row.remove());
}

function openCreateForm() {
  document.getElementById('card-id').value = '';
  document.getElementById('card-title').value = '';
  document.getElementById('card-subtitle').value = '';
  clearDynamicRows();

  addContentRow('Chave', '');
  addContentRow('Matrícula', '');
  addContentRow('Carga horária', '');

  document.getElementById('form-title').innerText = 'Cadastrar Novo Card';
  document.getElementById('btn-save-card').innerText = 'Salvar Card';

  showSection('section-cadastrar');
}

function openEditForm(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('card-id').value = card.id;
  document.getElementById('card-title').value = card.titulo;
  document.getElementById('card-subtitle').value = card.legenda;
  clearDynamicRows();

  if (typeof card.conteudo === 'object' && card.conteudo !== null) {
    Object.entries(card.conteudo).forEach(([key, val]) => {
      addContentRow(key, val);
    });
  }

  document.getElementById('form-title').innerText = 'Editar Card';
  document.getElementById('btn-save-card').innerText = 'Atualizar Card';

  showSection('section-cadastrar');
}

// Salva e refaz automaticamente a verificação da bolinha em tempo real
function handleSaveCard(event) {
  event.preventDefault();

  const cardId = document.getElementById('card-id').value;
  const titulo = parseExcelValue(document.getElementById('card-title').value.trim());
  const legenda = parseExcelValue(document.getElementById('card-subtitle').value.trim());

  if (!titulo || !legenda) return;

  const conteudoObj = {};
  const dynamicRows = document.querySelectorAll('.dynamic-content-row');

  dynamicRows.forEach(row => {
    const keyInput = row.querySelector('.input-key');
    const valInput = row.querySelector('.input-val');

    if (keyInput && valInput) {
      const k = keyInput.value.trim();
      const v = parseExcelValue(valInput.value.trim());
      if (k) conteudoObj[k] = v;
    }
  });

  if (cardId) {
    const index = cardsData.findIndex(c => c.id === cardId);
    if (index !== -1) {
      cardsData[index].titulo = titulo;
      cardsData[index].legenda = legenda;
      cardsData[index].conteudo = conteudoObj;
    }
  } else {
    const newCard = {
      id: `card-${Date.now()}`,
      titulo: titulo,
      legenda: legenda,
      conteudo: conteudoObj
    };
    cardsData.push(newCard);
  }

  saveToLocalStorage();
  updateFileInfoBar();
  renderCards();

  document.getElementById('card-form').reset();
  showSection('section-visualizar');
}

function deleteCard(cardId) {
  cardsData = cardsData.filter(c => c.id !== cardId);
  saveToLocalStorage();
  updateFileInfoBar();
  renderCards();
  showSection('section-visualizar');
}

// Filtro de Busca em tempo real
function setupSearchFilter() {
  const searchInput = document.getElementById('card-search');
  const dateFilter = document.getElementById('card-date-filter');
  const sortOrder = document.getElementById('card-sort-order');
  if (searchInput) {
    searchInput.addEventListener('input', filterCards);
  }
  if (dateFilter) {
    dateFilter.addEventListener('change', filterCards);
  }
  if (sortOrder) {
    sortOrder.addEventListener('change', filterCards);
  }
}

function filterCards() {
  const searchInput = document.getElementById('card-search');
  const dateFilter = document.getElementById('card-date-filter');
  const sortOrder = document.getElementById('card-sort-order');
  if (!searchInput || !dateFilter || !sortOrder) return;

  const query = searchInput.value.toLowerCase().trim();
  const selectedDate = dateFilter.value;
  const cardArticles = document.querySelectorAll('#main-grid .card');
  let visibleCount = 0;

  cardArticles.forEach(cardElem => {
    const cardId = cardElem.getAttribute('data-card-id');
    const card = cardsData.find(c => c.id === cardId);

    if (!card) return;

    const values = [card.titulo, card.legenda];
    if (card.conteudo && typeof card.conteudo === 'object') {
      Object.entries(card.conteudo).forEach(([key, value]) => values.push(key, value));
    }
    const matches = !query || values.some(value => String(value ?? '').toLowerCase().includes(query));
    const hasToday = checkIfCardHasTodayDate(card);
    const matchesDate = selectedDate === 'all' ||
      (selectedDate === 'today' && hasToday) ||
      (selectedDate === 'other' && !hasToday);

    if (matches && matchesDate) {
      cardElem.removeAttribute('hidden');
      visibleCount++;
    } else {
      cardElem.setAttribute('hidden', 'true');
    }
  });

  if (sortOrder.value !== 'original') {
    const cardsById = new Map(cardsData.map(card => [String(card.id), card]));
    const cards = Array.from(cardArticles).map((element, index) => ({
      element,
      index,
      date: getCardDateForSort(cardsById.get(element.getAttribute('data-card-id')))
    }));
    const direction = sortOrder.value === 'asc' ? 1 : -1;
    cards.sort((a, b) => {
      if (!a.date && !b.date) return a.index - b.index;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return (a.date - b.date) * direction || a.index - b.index;
    });
    const grid = document.getElementById('main-grid');
    cards.forEach(({ element }) => grid.appendChild(element));
  }

  updateSearchCounter(visibleCount, cardsData.length);
}

function getCardDateForSort(card) {
  if (!card) return null;
  const values = [card.legenda];
  if (card.conteudo && typeof card.conteudo === 'object') {
    values.push(...Object.values(card.conteudo));
  }
  const dates = values
    .map(value => extractDateObject(value))
    .filter(date => date && !isNaN(date.getTime()));
  return dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : null;
}

function updateSearchCounter(visible, total) {
  const resultsElem = document.getElementById('search-results');
  if (!resultsElem) return;

  if (total === 0) {
    resultsElem.innerText = '';
  } else {
    resultsElem.innerText = `Exibindo ${visible} de ${total} card(s)`;
  }
}

// Alternância de Temas (Claro / Escuro)
function setupThemeToggle() {
  const themeBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('minsait_portal_theme') || 'light';

  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('minsait_portal_theme', newTheme);
      updateThemeButton(newTheme);
    });
  }
}

function updateThemeButton(theme) {
  const themeBtn = document.getElementById('theme-toggle');
  if (!themeBtn) return;

  if (theme === 'dark') {
    themeBtn.innerText = 'Modo claro';
    themeBtn.setAttribute('aria-pressed', 'true');
  } else {
    themeBtn.innerText = 'Modo escuro';
    themeBtn.setAttribute('aria-pressed', 'false');
  }
}

// Popover do Menu Status
function setupStatusPopover() {
  const toggleBtn = document.getElementById('status-menu-toggle');
  const popover = document.getElementById('status-popover');

  if (toggleBtn && popover) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popover.hasAttribute('hidden');
      if (isHidden) {
        popover.removeAttribute('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        popover.setAttribute('hidden', 'true');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && e.target !== toggleBtn) {
        popover.setAttribute('hidden', 'true');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }
}

// Alterna seções da SPA
function showSection(sectionId) {
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  const detailPages = document.querySelectorAll('.content-page');
  detailPages.forEach(page => page.classList.remove('active'));

  const btnVis = document.getElementById('nav-visualizar');
  const btnCad = document.getElementById('nav-cadastrar');

  if (btnVis) btnVis.classList.remove('nav-active');
  if (btnCad) btnCad.classList.remove('nav-active');

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  if (sectionId === 'section-visualizar' && btnVis) {
    btnVis.classList.add('nav-active');
  } else if (sectionId === 'section-cadastrar' && btnCad) {
    btnCad.classList.add('nav-active');
  }
}

// Exibe detalhes do card
function openPage(pageId) {
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => sec.classList.remove('active'));

  const detailPages = document.querySelectorAll('.content-page');
  detailPages.forEach(page => page.classList.remove('active'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Sanitização de texto
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
