(() => {
  'use strict';

  const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

  const UPLOAD_STEPS = [
    { key: 'uploading', label: 'Uploading...' },
    { key: 'parsing', label: 'Parsing PDF...' },
    { key: 'cleaning', label: 'Cleaning...' },
    { key: 'chunking', label: 'Chunking...' },
    { key: 'embedding', label: 'Generating Embeddings...' },
    { key: 'saving', label: 'Saving to ChromaDB...' },
    { key: 'ready', label: 'Knowledge Base Ready' },
  ];

  const CHAT_STATUS_STEPS = [
    'Searching Knowledge Base...',
    'Building Context...',
    'Thinking...',
    'Generating Answer...',
  ];

  // ---------- DOM references ----------
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const selectedFile = document.getElementById('selectedFile');
  const selectedFileName = document.getElementById('selectedFileName');
  const progressPanel = document.getElementById('progressPanel');
  const progressBar = document.getElementById('progressBar');
  const progressSteps = document.getElementById('progressSteps');
  const successPanel = document.getElementById('successPanel');
  const uploadErrorPanel = document.getElementById('uploadErrorPanel');
  const documentList = document.getElementById('documentList');

  const chatWindow = document.getElementById('chatWindow');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatStatus = document.getElementById('chatStatus');
  const chatStatusText = document.getElementById('chatStatusText');

  let selectedPdfFile = null;
  let hasIndexedDocument = false;

  // ==========================================================
  // Knowledge Upload
  // ==========================================================

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('border-indigo-400', 'bg-indigo-50/50');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-indigo-400', 'bg-indigo-50/50');
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('border-indigo-400', 'bg-indigo-50/50');
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) handleFileSelected(file);
  });

  function handleFileSelected(file) {
    resetUploadPanels();

    if (file.type !== 'application/pdf') {
      showUploadError('Only PDF files are supported.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      showUploadError('File exceeds the maximum allowed size of 10MB.');
      return;
    }

    selectedPdfFile = file;
    selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
    selectedFile.classList.remove('hidden');
    selectedFile.classList.add('flex');
    uploadBtn.disabled = false;
  }

  uploadBtn.addEventListener('click', () => {
    if (!selectedPdfFile) return;
    uploadDocument(selectedPdfFile);
  });

  function uploadDocument(file) {
    resetUploadPanels();
    uploadBtn.disabled = true;

    progressPanel.classList.remove('hidden');
    renderProgressSteps('uploading', 0);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/knowledge/upload');

    let simulationTimer = null;

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      progressBar.style.width = `${Math.min(percent, 100)}%`;
      if (percent >= 100) {
        renderProgressSteps('parsing', 100);
        simulationTimer = startServerProcessingSimulation();
      } else {
        renderProgressSteps('uploading', percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (simulationTimer) clearInterval(simulationTimer);

      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch (_error) {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        renderProgressSteps('ready', 100);
        showUploadSuccess(payload);
        addDocumentToList(payload);
      } else {
        const message = payload.message
          ? Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
          : 'Upload failed. Please try again.';
        showUploadError(message);
        progressPanel.classList.add('hidden');
      }

      uploadBtn.disabled = false;
    });

    xhr.addEventListener('error', () => {
      if (simulationTimer) clearInterval(simulationTimer);
      showUploadError('Network error while uploading. Please check your connection and try again.');
      progressPanel.classList.add('hidden');
      uploadBtn.disabled = false;
    });

    xhr.send(formData);
  }

  /** After the upload itself completes, the server is still parsing/embedding/storing - animate through those steps until the response arrives. */
  function startServerProcessingSimulation() {
    const serverSteps = ['parsing', 'cleaning', 'chunking', 'embedding', 'saving'];
    let index = 0;
    renderProgressSteps(serverSteps[index], 100);

    return setInterval(() => {
      index = Math.min(index + 1, serverSteps.length - 1);
      renderProgressSteps(serverSteps[index], 100);
    }, 900);
  }

  function renderProgressSteps(activeKey, uploadPercent) {
    progressBar.style.width = `${uploadPercent}%`;
    const activeIndex = UPLOAD_STEPS.findIndex((step) => step.key === activeKey);

    progressSteps.innerHTML = UPLOAD_STEPS.map((step, index) => {
      let icon;
      let textClass;
      if (index < activeIndex) {
        icon = doneIconSvg();
        textClass = 'text-slate-400 line-through';
      } else if (index === activeIndex) {
        icon = activeIconSvg();
        textClass = 'text-indigo-600 font-semibold';
      } else {
        icon = pendingIconSvg();
        textClass = 'text-slate-300';
      }
      return `<li class="flex items-center gap-2 ${textClass}">${icon}<span>${step.label}</span></li>`;
    }).join('');
  }

  function doneIconSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.9 3.9 6.7-6.7a1 1 0 011.4 0z" clip-rule="evenodd"/></svg>';
  }
  function activeIconSvg() {
    return '<svg class="h-3.5 w-3.5 flex-shrink-0 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
  }
  function pendingIconSvg() {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="4"/></svg>';
  }

  function showUploadSuccess(payload) {
    successPanel.classList.remove('hidden');
    successPanel.innerHTML = `
      <p class="font-semibold">Knowledge Base Ready</p>
      <p class="mt-1 text-emerald-600">"${escapeHtml(payload.filename || 'Document')}" indexed successfully &middot; ${payload.pageCount ?? '?'} pages &middot; ${payload.chunkCount ?? '?'} chunks</p>
    `;
    selectedPdfFile = null;
    selectedFile.classList.add('hidden');
    fileInput.value = '';
  }

  function showUploadError(message) {
    uploadErrorPanel.classList.remove('hidden');
    uploadErrorPanel.textContent = message;
  }

  function resetUploadPanels() {
    successPanel.classList.add('hidden');
    successPanel.innerHTML = '';
    uploadErrorPanel.classList.add('hidden');
    uploadErrorPanel.textContent = '';
  }

  function addDocumentToList(payload) {
    if (!hasIndexedDocument) {
      documentList.innerHTML = '';
      hasIndexedDocument = true;
    }
    const item = document.createElement('li');
    item.className = 'fade-in flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2';
    item.innerHTML = `
      <span class="truncate font-medium text-slate-600">${escapeHtml(payload.filename || 'Document')}</span>
      <span class="ml-2 flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">${payload.chunkCount ?? '?'} chunks</span>
    `;
    documentList.prepend(item);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // ==========================================================
  // AI Chat
  // ==========================================================

  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 128)}px`;
  });

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    appendUserMessage(question);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendQuestion(question);
  });

  async function sendQuestion(question) {
    setChatBusy(true);
    const statusTimer = cycleChatStatus();

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.message
          ? Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
          : 'Something went wrong. Please try again.';
        appendAssistantError(message);
        return;
      }

      await appendAssistantMessage(payload.answer || '', payload.sources || []);
    } catch (_error) {
      appendAssistantError('Network error - could not reach the server. Please try again.');
    } finally {
      clearInterval(statusTimer);
      setChatBusy(false);
    }
  }

  function cycleChatStatus() {
    let index = 0;
    chatStatus.classList.remove('hidden');
    chatStatus.classList.add('flex');
    chatStatusText.textContent = CHAT_STATUS_STEPS[index];

    return setInterval(() => {
      index = (index + 1) % CHAT_STATUS_STEPS.length;
      chatStatusText.textContent = CHAT_STATUS_STEPS[index];
    }, 1100);
  }

  function setChatBusy(isBusy) {
    sendBtn.disabled = isBusy;
    chatInput.disabled = isBusy;
    if (!isBusy) {
      chatStatus.classList.add('hidden');
      chatStatus.classList.remove('flex');
    }
  }

  function appendUserMessage(text) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fade-in flex justify-end';
    wrapper.innerHTML = `
      <div class="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-3 text-sm text-white shadow-sm">
        ${escapeHtml(text)}
      </div>
    `;
    chatWindow.appendChild(wrapper);
    scrollChatToBottom();
  }

  function appendAssistantError(message) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fade-in flex justify-start';
    wrapper.innerHTML = `
      <div class="max-w-[75%] rounded-2xl rounded-bl-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        ${escapeHtml(message)}
      </div>
    `;
    chatWindow.appendChild(wrapper);
    scrollChatToBottom();
  }

  async function appendAssistantMessage(text, sources) {
    const wrapper = document.createElement('div');
    wrapper.className = 'fade-in flex justify-start';

    const bubble = document.createElement('div');
    bubble.className = 'max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 text-sm text-slate-700';
    wrapper.appendChild(bubble);
    chatWindow.appendChild(wrapper);
    scrollChatToBottom();

    await typeText(bubble, text);

    if (sources && sources.length > 0) {
      const sourcesEl = document.createElement('div');
      sourcesEl.className = 'mt-2 flex flex-wrap gap-1.5';
      sourcesEl.innerHTML = sources
        .map(
          (source) =>
            `<span class="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h5.586A2 2 0 0113 2.586L15.414 5A2 2 0 0116 6.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
              ${escapeHtml(source)}
            </span>`,
        )
        .join('');
      wrapper.appendChild(sourcesEl);
      scrollChatToBottom();
    }
  }

  function typeText(element, text) {
    return new Promise((resolve) => {
      if (!text) {
        resolve();
        return;
      }
      let index = 0;
      const speed = text.length > 400 ? 4 : 12;
      const timer = setInterval(() => {
        index += 3;
        element.textContent = text.slice(0, index);
        scrollChatToBottom();
        if (index >= text.length) {
          clearInterval(timer);
          element.textContent = text;
          resolve();
        }
      }, speed);
    });
  }

  function scrollChatToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }
})();
