let cardsData = [];
let currentLoadedFileName = null;
let currentLoadedFileHandle = null;
let hasPendingFileChanges = false;
let localStorageWarning = '';
let noticeTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('minsait_portal_theme') || 'light';
  } catch (err) {
    console.warn('Não foi possível ler a preferência de tema:', err);
  }
  setTheme(savedTheme === 'dark');
  if (themeToggle) themeToggle.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme !== 'dark');
  });

  const statusToggle = document.getElementById('status-menu-toggle');
  const statusPopover = document.getElementById('status-popover');
  if (statusToggle && statusPopover) {
    statusToggle.addEventListener('click', () => {
      const isOpen = !statusPopover.hidden;
      statusPopover.hidden = isOpen;
      statusToggle.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.status-menu-item')) {
        statusPopover.hidden = true;
        statusToggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !statusPopover.hidden) {
        statusPopover.hidden = true;
        statusToggle.setAttribute('aria-expanded', 'false');
        statusToggle.focus();
      }
    });
  }

  // Inicialização: carrega os dados salvos no Local Storage ao abrir a página
  loadFromLocalStorage();

  const cardForm = document.getElementById('card-form');
  if (cardForm) {
    cardForm.addEventListener('submit', handleSaveCard);
  }

  const cardSearch = document.getElementById('card-search');
  if (cardSearch) cardSearch.addEventListener('input', filterCards);

});

function setTheme(darkMode) {
  document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.textContent = darkMode ? 'Modo claro' : 'Modo escuro';
    toggle.setAttribute('aria-label', darkMode ? 'Ativar tema claro' : 'Ativar tema escuro');
    toggle.setAttribute('aria-pressed', String(darkMode));
  }
  try {
    localStorage.setItem('minsait_portal_theme', darkMode ? 'dark' : 'light');
  } catch (err) {
    console.warn('Não foi possível salvar a preferência de tema:', err);
  }
}

function showNotice(message, type = 'info') {
  const notice = document.getElementById('app-notice');
  if (!notice) return;

  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.className = `app-notice app-notice-${type}`;
  notice.hidden = false;
  noticeTimer = setTimeout(() => {
    notice.hidden = true;
    notice.textContent = '';
  }, type === 'error' ? 10000 : 6500);
}

// Carrega os dados persistidos no Local Storage
function loadFromLocalStorage() {
  try {
    const cachedData = localStorage.getItem('minsait_portal_cards');
    const cachedFileName = localStorage.getItem('minsait_portal_filename');
    const cachedDirtyState = localStorage.getItem('minsait_portal_file_dirty');

    if (cachedData) {
      cardsData = JSON.parse(cachedData);
      const validation = validateCardsData(cardsData);
      if (!validation.valid) {
        cardsData = [];
        localStorageWarning = 'Os dados locais estão inválidos. Carregue um JSON válido para continuar.';
      }
      currentLoadedFileName = cachedFileName || null;
      hasPendingFileChanges = cachedDirtyState === null ? cardsData.length > 0 : cachedDirtyState === 'true';
    } else {
      cardsData = [];
    }
  } catch (err) {
    cardsData = [];
    currentLoadedFileName = null;
    localStorageWarning = 'Não foi possível acessar os dados salvos neste navegador.';
  }

  updateFileInfoBar();
  renderCards();
}

// Salva o estado atual no Local Storage
function saveToLocalStorage() {
  try {
    localStorage.setItem('minsait_portal_cards', JSON.stringify(cardsData));
    if (currentLoadedFileName) {
      localStorage.setItem('minsait_portal_filename', currentLoadedFileName);
    } else {
      localStorage.removeItem('minsait_portal_filename');
    }
    localStorage.setItem('minsait_portal_file_dirty', String(hasPendingFileChanges));
    localStorageWarning = '';
    return true;
  } catch (err) {
    console.error('Erro ao salvar no armazenamento local:', err);
    localStorageWarning = 'Não foi possível salvar neste navegador. Exporte um JSON para não perder os dados.';
    return false;
  }
}

// Valida o formato do arquivo antes de substituir os dados atuais.
function validateCardsData(value) {
  if (!Array.isArray(value)) {
    return { valid: false, errors: ['O arquivo precisa conter uma lista de cards.'] };
  }

  const errors = [];
  const ids = new Set();
  value.forEach((card, index) => {
    const label = `Card ${index + 1}`;
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      errors.push(`${label}: esperado um objeto.`);
      return;
    }
    if (typeof card.id !== 'string' || !/^[\w-]+$/.test(card.id)) {
      errors.push(`${label}: ID ausente ou inválido (use letras, números, hífen ou sublinhado).`);
    } else if (ids.has(card.id)) {
      errors.push(`${label}: ID duplicado.`);
    } else {
      ids.add(card.id);
    }
    if (typeof card.titulo !== 'string' || !card.titulo.trim()) errors.push(`${label}: título ausente ou inválido.`);
    if (typeof card.legenda !== 'string' || !card.legenda.trim()) errors.push(`${label}: legenda ausente ou inválida.`);
    const contentIsObject = card.conteudo && typeof card.conteudo === 'object' && !Array.isArray(card.conteudo);
    const contentIsText = typeof card.conteudo === 'string' && card.conteudo.trim();
    if (!contentIsObject && !contentIsText) errors.push(`${label}: conteúdo ausente ou inválido.`);
  });

  return { valid: errors.length === 0, errors };
}

// BOTÃO "Abrir JSON": importa e valida antes de substituir a lista atual.
async function loadFromFile() {
  try {
    let fileText = '';
    let fileName = '';
    let fileHandle = null;

    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Arquivo JSON',
          accept: { 'application/json': ['.json'] }
        }]
      });
      const file = await handle.getFile();
      fileHandle = handle;
      fileName = file.name;
      fileText = await file.text();
    } else {
      const selectedFile = await openFileFallback();
      fileText = selectedFile.text;
      fileName = selectedFile.name;
    }

    const parsed = JSON.parse(fileText);
    const validation = validateCardsData(parsed);
    if (!validation.valid) {
      throw new Error(validation.errors.slice(0, 5).join('\n'));
    }

    const replacedPendingData = hasPendingFileChanges;

    cardsData = parsed;
    currentLoadedFileName = fileName;
    currentLoadedFileHandle = fileHandle;
    hasPendingFileChanges = false;

    renderCards();
    showSection('section-visualizar');

    const savedLocally = saveToLocalStorage();
    updateFileInfoBar();
    const message = replacedPendingData
      ? `Arquivo "${fileName}" carregado. Os dados locais pendentes foram substituídos.`
      : `Arquivo "${fileName}" carregado com sucesso.`;
    showNotice(savedLocally ? message : `${message} Não foi possível salvar uma cópia no armazenamento do navegador.`, savedLocally ? (replacedPendingData ? 'warning' : 'success') : 'error');
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error('Erro ao ler o arquivo JSON:', err);
      showNotice(`Não foi possível carregar o arquivo JSON. ${err.message || 'Verifique se o arquivo pode ser lido.'}`, 'error');
    }
  }
}

// Fallback de abertura de arquivo caso File System Access API não esteja disponível
function openFileFallback() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return reject(new DOMException('Nenhum arquivo selecionado.', 'AbortError'));
      const reader = new FileReader();
      reader.onload = event => resolve({ text: event.target.result, name: file.name });
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    };
    input.addEventListener('cancel', () => reject(new DOMException('Seleção cancelada.', 'AbortError')));
    input.click();
  });
}

// Salva no arquivo carregado ou abre o seletor para criar/substituir uma cópia.
async function saveToFile() {
  if (cardsData.length === 0) {
    showNotice('A lista está vazia. Cadastre um card antes de salvar.', 'warning');
    return;
  }

  const jsonString = JSON.stringify(cardsData, null, 2);

  try {
    let handle = null;
    if (currentLoadedFileHandle) {
      handle = currentLoadedFileHandle;
      let permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') throw new Error('Permissão para gravar no arquivo não concedida.');
    } else if ('showSaveFilePicker' in window) {
      handle = await window.showSaveFilePicker({
        suggestedName: currentLoadedFileName || 'cards.json',
        types: [{
          description: 'Arquivo JSON',
          accept: { 'application/json': ['.json'] }
        }]
      });
    }

    if (!handle) {
      const fileName = normalizeJsonFileName(currentLoadedFileName || 'cards.json');
      downloadJsonFallback(jsonString, fileName);
      currentLoadedFileName = fileName;
      hasPendingFileChanges = false;
      const savedLocally = saveToLocalStorage();
      updateFileInfoBar();
      const fallbackMessage = `JSON exportado como "${fileName}". Confira a pasta de downloads do navegador.`;
      showNotice(savedLocally ? fallbackMessage : `${fallbackMessage} O armazenamento local também não pôde ser atualizado.`, savedLocally ? 'success' : 'warning');
      return;
    }

    const writable = await handle.createWritable();
    await writable.write(jsonString);
    await writable.close();

    currentLoadedFileHandle = handle;
    currentLoadedFileName = handle.name;
    hasPendingFileChanges = false;
    const savedLocally = saveToLocalStorage();
    updateFileInfoBar();

    showNotice(savedLocally
      ? `Arquivo "${handle.name}" salvo com sucesso.`
      : `Arquivo "${handle.name}" salvo. O armazenamento local não pôde ser atualizado.`, savedLocally ? 'success' : 'warning');
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error('Erro ao salvar o arquivo:', err);
      showNotice(`Não foi possível salvar o arquivo. ${err.message || 'Verifique a permissão e o espaço disponível.'}`, 'error');
    }
  }
}

function normalizeJsonFileName(fileName) {
  const safeName = fileName.trim().split(/[\\/]/).pop() || 'cards';
  return safeName.toLowerCase().endsWith('.json') ? safeName : `${safeName}.json`;
}

// Fallback de download
function downloadJsonFallback(jsonContent, fileName) {
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || currentLoadedFileName || 'cards.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Atualiza a barra informativa superior
function updateFileInfoBar() {
  const fileInfoBar = document.getElementById('file-info-bar');
  if (!fileInfoBar) return;

  const statusToggle = document.getElementById('status-menu-toggle');

  const origin = currentLoadedFileName ? escapeHtml(currentLoadedFileName) : 'Armazenamento local';
  const count = `${cardsData.length} card(s)`;
  const statusClass = localStorageWarning ? 'file-state-warning' : hasPendingFileChanges ? 'file-state-pending' : 'file-state-saved';
  const statusText = localStorageWarning || (hasPendingFileChanges
    ? '● Alterações locais pendentes de exportação'
    : 'Sem alterações locais pendentes');
  if (statusToggle) statusToggle.dataset.state = localStorageWarning ? 'warning' : hasPendingFileChanges ? 'pending' : 'saved';

  fileInfoBar.innerHTML = `
    <div class="file-info-content">
      <div>Dados de: <strong>${origin}</strong> (${count})</div>
      <span class="${statusClass}">${escapeHtml(statusText)}</span>
      ${cardsData.length === 0 ? '<div class="file-empty-hint">A lista está vazia. Abra um JSON ou cadastre um card.</div>' : ''}
    </div>
  `;
}

/**
 * Converte o campo 'conteudo' em uma tabela HTML.
 * Funciona tanto se conteudo for um OBJETO JSON quanto se for STRING.
 */
function formatContentToTable(conteudo) {
  if (!conteudo) return '';

  let entries = [];

  // Se o conteúdo já for um objeto JSON
  if (typeof conteudo === 'object' && !Array.isArray(conteudo)) {
    entries = Object.entries(conteudo);
  } else if (typeof conteudo === 'string') {
    // Se for string, converte usando regex
    const regex = /([\w\sáàâãéèêíïóôõöúçñ\-\/]+):\s*([^\n:]+?)(?=\s+[\w\sáàâãéèêíïóôõöúçñ\-\/]+:|\n|\$)/gi;
    const matches = [...conteudo.matchAll(regex)];
    entries = matches.map(m => [m[1].trim(), m[2].trim()]);
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

  // Se não for possível montar a tabela, exibe como texto formatado
  return `<p class="formatted-paragraph">${escapeHtml(String(conteudo)).replace(/\n/g, '<br>')}</p>`;
}

/** Normaliza o conteúdo antigo (objeto ou texto Chave: Valor) para as linhas editáveis. */
function contentToEntries(conteudo) {
  if (conteudo && typeof conteudo === 'object' && !Array.isArray(conteudo)) {
    return Object.entries(conteudo);
  }

  if (typeof conteudo === 'string') {
    const entries = conteudo.split(/\r?\n/).reduce((result, line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex < 0) return result;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key) result.push([key, value]);
      return result;
    }, []);

    if (entries.length) return entries;
    return conteudo.trim() ? [['Conteúdo', conteudo]] : [];
  }

  if (Array.isArray(conteudo)) return [['Conteúdo', JSON.stringify(conteudo)]];
  return conteudo == null ? [] : [['Conteúdo', String(conteudo)]];
}

/** Adiciona uma linha seguindo o mesmo padrão Campo / Informação da tabela de detalhes. */
function addContentRow(key = '', value = '') {
  const tableBody = document.getElementById('form-table-body');
  if (!tableBody) return;

  const row = document.createElement('tr');
  row.className = 'content-entry-row';

  const keyCell = document.createElement('td');
  keyCell.className = 'table-key';
  const keyInput = document.createElement('input');
  keyInput.className = 'table-editor-input';
  keyInput.type = 'text';
  keyInput.placeholder = 'Nome do campo';
  keyInput.setAttribute('aria-label', 'Nome do campo');
  keyInput.required = true;
  keyInput.value = key;
  keyCell.appendChild(keyInput);

  const valueCell = document.createElement('td');
  valueCell.className = 'table-val';
  const entryCell = document.createElement('div');
  entryCell.className = 'form-entry-cell';
  const valueInput = document.createElement('textarea');
  valueInput.className = 'table-editor-input';
  valueInput.rows = 2;
  valueInput.placeholder = 'Digite a informação';
  valueInput.setAttribute('aria-label', 'Informação do campo');
  valueInput.required = true;
  valueInput.value = value;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn-remove-field';
  removeButton.textContent = 'Remover';
  removeButton.setAttribute('aria-label', 'Remover campo');
  removeButton.addEventListener('click', () => {
    const rows = tableBody.querySelectorAll('.content-entry-row');
    if (rows.length <= 1) return;
    row.remove();
    const remainingRows = tableBody.querySelectorAll('.content-entry-row');
    if (remainingRows.length === 1) remainingRows[0].querySelector('.btn-remove-field').disabled = true;
  });

  entryCell.append(valueInput, removeButton);
  valueCell.appendChild(entryCell);
  row.append(keyCell, valueCell);
  tableBody.appendChild(row);
  if (tableBody.querySelectorAll('.content-entry-row').length > 1) {
    tableBody.querySelectorAll('.btn-remove-field').forEach(button => { button.disabled = false; });
  } else {
    removeButton.disabled = true;
  }
}

function resetContentRows(entries = []) {
  const tableBody = document.getElementById('form-table-body');
  if (!tableBody) return;

  tableBody.querySelectorAll('.content-entry-row').forEach(row => row.remove());
  (entries.length ? entries : [['', '']]).forEach(([key, value]) => addContentRow(String(key), String(value)));
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
        <p>Cadastre um novo card ou carregue um arquivo JSON do seu computador.</p>
        <button class="btn-primary" style="max-width: 250px; margin: 0 auto;" onclick="openCreateForm()">
          Cadastrar Primeiro Card
        </button>
      </div>
    `;
    return;
  }

  const noResults = document.createElement('div');
  noResults.className = 'empty-state search-empty-state';
  noResults.hidden = true;
  noResults.innerHTML = '<h3>Nenhum card encontrado</h3><p>Tente buscar por outro termo ou limpe o campo de busca.</p>';
  gridContainer.appendChild(noResults);

  cardsData.forEach(card => {
    // 1. Card na Grade Principal
    const content = typeof card.conteudo === 'string'
      ? card.conteudo
      : Object.entries(card.conteudo || {}).flat().join(' ');
    const searchableText = normalizeSearchText(`${card.titulo} ${card.legenda} ${content}`);
    const cardElement = document.createElement('article');
    cardElement.className = 'card';
    cardElement.dataset.searchText = searchableText;
    cardElement.innerHTML = `
      <div onclick="openPage('${card.id}')" style="cursor: pointer;">
        <h2>${escapeHtml(card.titulo)}</h2>
        <p>${escapeHtml(card.legenda)}</p>
      </div>
      <div class="card-footer">
        <span class="link-hint" onclick="openPage('${card.id}')">Acessar conteúdo</span>
        <div class="card-actions">
          <button class="btn-action btn-edit" onclick="openEditForm('${card.id}')" title="Editar Card">Editar</button>
          <button class="btn-action btn-delete" onclick="deleteCard('${card.id}')" title="Excluir Card">Excluir</button>
        </div>
      </div>
      `;
    gridContainer.appendChild(cardElement);

    // 2. Página Detalhada com Tabela
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

function filterCards() {
  const gridContainer = document.getElementById('main-grid');
  const searchInput = document.getElementById('card-search');
  const resultsLabel = document.getElementById('search-results');
  if (!gridContainer || !searchInput || !resultsLabel) return;

  const query = normalizeSearchText(searchInput.value);
  const cards = [...gridContainer.querySelectorAll('.card[data-search-text]')];
  let visibleCount = 0;

  cards.forEach(card => {
    const matches = card.dataset.searchText.includes(query);
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  const noResults = gridContainer.querySelector('.search-empty-state');
  if (noResults) noResults.hidden = visibleCount > 0;
  resultsLabel.textContent = query
    ? `${visibleCount} de ${cards.length} cards encontrados`
    : `${cards.length} card(s) cadastrados`;
}

function normalizeSearchText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

// Prepara o formulário para inclusão de novo card
function openCreateForm() {
  document.getElementById('card-id').value = '';
  document.getElementById('card-title').value = '';
  document.getElementById('card-subtitle').value = '';
  resetContentRows();

  document.getElementById('form-title').innerText = 'Cadastrar Novo Card';
  document.getElementById('btn-save-card').innerText = 'Salvar Card';

  showSection('section-cadastrar');
}

// Prepara o formulário preenchido para edição
function openEditForm(cardId) {
  const card = cardsData.find(c => c.id === cardId);
  if (!card) return;

  document.getElementById('card-id').value = card.id;
  document.getElementById('card-title').value = card.titulo;
  document.getElementById('card-subtitle').value = card.legenda;
  resetContentRows(contentToEntries(card.conteudo));

  document.getElementById('form-title').innerText = 'Editar Card';
  document.getElementById('btn-save-card').innerText = 'Atualizar Card';

  showSection('section-cadastrar');
}

// Salva/Atualiza o card diretamente no Local Storage
function handleSaveCard(event) {
  event.preventDefault();

  const cardId = document.getElementById('card-id').value;
  const titulo = document.getElementById('card-title').value.trim();
  const legenda = document.getElementById('card-subtitle').value.trim();
  const contentRows = [...document.querySelectorAll('#form-table-body .content-entry-row')];

  if (!titulo || !legenda || contentRows.length === 0) return;

  const conteudoFormatado = Object.create(null);
  for (const row of contentRows) {
    const [keyInput, valueInput] = row.querySelectorAll('.table-editor-input');
    const key = keyInput.value.trim();
    const value = valueInput.value.trim();

    if (!key || !value) return;
    if (Object.prototype.hasOwnProperty.call(conteudoFormatado, key)) {
      showNotice(`O campo "${key}" está repetido. Use nomes diferentes para cada campo.`, 'error');
      keyInput.focus();
      return;
    }
    conteudoFormatado[key] = value;
  }

  if (cardId) {
    const index = cardsData.findIndex(c => c.id === cardId);
    if (index !== -1) {
      cardsData[index].titulo = titulo;
      cardsData[index].legenda = legenda;
      cardsData[index].conteudo = conteudoFormatado;
    }
  } else {
    const newCard = {
      id: `card-${Date.now()}`,
      titulo: titulo,
      legenda: legenda,
      conteudo: conteudoFormatado
    };
    cardsData.push(newCard);
  }

  hasPendingFileChanges = true;
  saveToLocalStorage();
  updateFileInfoBar();
  renderCards();

  document.getElementById('card-form').reset();
  showSection('section-visualizar');
}

// Remove o card e atualiza o Local Storage
function deleteCard(cardId) {
  if (!cardsData.some(card => card.id === cardId)) return;

  cardsData = cardsData.filter(c => c.id !== cardId);

  hasPendingFileChanges = true;
  saveToLocalStorage();
  updateFileInfoBar();
  renderCards();
  showSection('section-visualizar');
}

// Alterna entre abas
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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
