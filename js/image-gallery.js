// js/image-gallery.js
// Galeria de imagens de referência por conceito
// Suporta: upload via botão "+", drag & drop na grade, Ctrl+V paste
import { supabase } from './supabaseClient.js';

const BUCKET = 'concept-images';

// ─── DATA LAYER ────────────────────────────────────────────────────────────────

export async function fetchConceptImages(conceitoName) {
    const { data, error } = await supabase
        .from('concept_images')
        .select('*')
        .eq('conceito_name', conceitoName)
        .order('created_at', { ascending: false });
    if (error) { console.error('fetchConceptImages:', error); return []; }
    return data;
}

export async function fetchAllImageTags() {
    const { data, error } = await supabase
        .from('concept_images')
        .select('tags');
    if (error) return [];
    const all = new Set();
    data.forEach(row => (row.tags || []).forEach(t => all.add(t)));
    return [...all].sort();
}

async function insertImageRecord(conceitoName, storagePath, publicUrl, filename) {
    const { data, error } = await supabase
        .from('concept_images')
        .insert({ conceito_name: conceitoName, storage_path: storagePath, public_url: publicUrl, filename })
        .select()
        .single();
    if (error) { console.error('insertImageRecord:', error); return null; }
    return data;
}

async function updateImageTags(imageId, tags) {
    const { error } = await supabase
        .from('concept_images')
        .update({ tags })
        .eq('id', imageId);
    if (error) console.error('updateImageTags:', error);
}

async function deleteImageRecord(imageId, storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    const { error } = await supabase.from('concept_images').delete().eq('id', imageId);
    if (error) console.error('deleteImageRecord:', error);
}

// ─── UPLOAD ────────────────────────────────────────────────────────────────────

async function uploadFile(file, conceitoName) {
    if (!file || !file.type.startsWith('image/')) return null;
    if (file.size > 5 * 1024 * 1024) { alert('Imagem muito grande. Limite: 5MB.'); return null; }
    const ext = file.name.split('.').pop() || 'png';
    const safeName = conceitoName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const path = `${safeName}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
    if (upErr) { console.error('uploadFile:', upErr); return null; }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return insertImageRecord(conceitoName, path, urlData.publicUrl, file.name);
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function tagColor(tag) {
    const hue = [...tag].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `background:hsl(${hue},60%,91%);border-color:hsl(${hue},50%,74%);color:hsl(${hue},45%,33%)`;
}

function tagPillHtml(tag, removable = false, imageId = '') {
    return `<span class="img-tag-pill" style="${tagColor(tag)}" data-tag="${tag}" data-image-id="${imageId}">${tag}${
        removable ? `<button class="img-tag-remove" data-tag="${tag}" data-image-id="${imageId}">×</button>` : ''
    }</span>`;
}

// ─── CARD HTML ─────────────────────────────────────────────────────────────────

function addCardHtml() {
    return `
        <div class="img-add-card" id="img-add-card" title="Adicionar imagem (ou arraste aqui · Ctrl+V)">
            <i data-lucide="plus" class="w-6 h-6 text-zinc-300"></i>
            <span class="img-add-card-hint">Adicionar</span>
        </div>`;
}

function imageCardHtml(img) {
    const tags = img.tags || [];
    return `
        <div class="img-card" data-image-id="${img.id}">
            <div class="img-card-thumb" data-lightbox="${img.id}">
                <img src="${img.public_url}" alt="${img.filename}" loading="lazy" />
                <div class="img-card-overlay">
                    <i data-lucide="maximize-2" class="w-4 h-4 text-white"></i>
                </div>
                <button class="img-delete-btn" data-image-id="${img.id}" data-storage-path="${img.storage_path}" title="Excluir">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            </div>
            <div class="img-card-footer">
                <div class="img-card-tags">
                    ${tags.map(t => tagPillHtml(t, true, img.id)).join('')}
                    <button class="img-add-tag-btn" data-image-id="${img.id}" title="Adicionar tag">
                        <i data-lucide="tag" class="w-2.5 h-2.5"></i>
                    </button>
                </div>
                <div class="img-tag-input-row" id="tag-input-row-${img.id}" style="display:none;">
                    <input class="img-tag-input" id="tag-input-${img.id}" placeholder="tag + Enter" autocomplete="off" data-image-id="${img.id}" />
                    <div class="img-tag-suggestions" id="tag-suggestions-${img.id}"></div>
                </div>
            </div>
        </div>`;
}

function lightboxHtml() {
    return `
        <div id="img-lightbox" class="img-lightbox" style="display:none;">
            <div class="img-lightbox-backdrop" id="lightbox-backdrop"></div>
            <div class="img-lightbox-content">
                <button id="lightbox-close" class="lightbox-close"><i data-lucide="x" class="w-4 h-4"></i></button>
                <button id="lightbox-prev" class="lightbox-nav lightbox-prev"><i data-lucide="chevron-left" class="w-6 h-6"></i></button>
                <div class="lightbox-img-wrap">
                    <img id="lightbox-img" src="" alt="" />
                </div>
                <button id="lightbox-next" class="lightbox-nav lightbox-next"><i data-lucide="chevron-right" class="w-6 h-6"></i></button>
                <div id="lightbox-footer" class="lightbox-footer">
                    <div id="lightbox-tags" class="lightbox-tags"></div>
                    <span id="lightbox-counter" class="lightbox-counter"></span>
                </div>
            </div>
        </div>`;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

export async function renderImageGallery(container, conceitoName) {
    container.innerHTML = `
        <div class="img-gallery-root" id="img-gallery-root">
            <div class="img-toolbar">
                <div class="img-toolbar-left">
                    <i data-lucide="images" class="w-3.5 h-3.5 text-zinc-400"></i>
                    <span class="text-[11px] text-zinc-400 font-medium">Galeria de Referências</span>
                </div>
                <div class="img-toolbar-right">
                    <span id="img-uploading-badge" style="display:none;" class="img-uploading-badge">
                        <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Enviando...
                    </span>
                    <span class="text-[10px] text-zinc-300">Ctrl+V · Arraste na grade</span>
                    <button id="img-add-btn" class="img-add-btn" title="Adicionar imagem">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        <span>Adicionar</span>
                    </button>
                </div>
            </div>
            <input type="file" id="img-file-input" accept="image/*" multiple style="display:none;" />
            <div id="img-grid" class="img-grid img-grid-5"></div>
            ${lightboxHtml()}
        </div>`;

    if (window.lucide) window.lucide.createIcons();

    const state = { images: [], allTags: [], lightboxIndex: 0 };

    const root       = container.querySelector('#img-gallery-root');
    const grid       = root.querySelector('#img-grid');
    const fileInput  = root.querySelector('#img-file-input');
    const uploadBadge = root.querySelector('#img-uploading-badge');

    // ── Render ──
    function renderGrid() {
        grid.innerHTML = state.images.length
            ? state.images.map(img => imageCardHtml(img)).join('')
            : `<p class="img-empty-hint">Nenhuma imagem ainda. Use o botão + acima, arraste ou cole com Ctrl+V.</p>`;
        if (window.lucide) window.lucide.createIcons();
        attachGridListeners();
    }

    async function reload() {
        const [images, allTags] = await Promise.all([fetchConceptImages(conceitoName), fetchAllImageTags()]);
        state.images = images;
        state.allTags = allTags;
        renderGrid();
    }

    // ── Upload ──
    async function handleFiles(files) {
        const arr = [...files].filter(f => f.type.startsWith('image/'));
        if (!arr.length) return;
        uploadBadge.style.display = 'inline-flex';
        grid.classList.add('uploading');
        for (const file of arr) {
            const img = await uploadFile(file, conceitoName);
            if (img) state.images.unshift(img);
        }
        state.allTags = await fetchAllImageTags();
        uploadBadge.style.display = 'none';
        grid.classList.remove('uploading');
        renderGrid();
    }

    // ── Drag & Drop na grade inteira ──
    grid.addEventListener('dragover', (e) => { e.preventDefault(); grid.classList.add('drag-over'); });
    grid.addEventListener('dragleave', (e) => { if (!grid.contains(e.relatedTarget)) grid.classList.remove('drag-over'); });
    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        grid.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // ── Paste ──
    function onPaste(e) {
        if (!root.isConnected) { document.removeEventListener('paste', onPaste); return; }
        const files = [...(e.clipboardData?.items || [])]
            .filter(i => i.type.startsWith('image/'))
            .map(i => i.getAsFile())
            .filter(Boolean);
        if (files.length) { e.preventDefault(); handleFiles(files); }
    }
    document.addEventListener('paste', onPaste);

    // ── Listeners da grade ──
    function attachGridListeners() {
        // Botão "+" no toolbar
        root.querySelector('#img-add-btn')?.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => { handleFiles(fileInput.files); fileInput.value = ''; }, { once: true });

        // Lightbox
        grid.querySelectorAll('[data-lightbox]').forEach(el => {
            el.addEventListener('click', () => {
                const idx = state.images.findIndex(i => i.id === el.getAttribute('data-lightbox'));
                openLightbox(idx);
            });
        });

        // Delete
        grid.querySelectorAll('.img-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Excluir esta imagem?')) return;
                const id = btn.getAttribute('data-image-id');
                await deleteImageRecord(id, btn.getAttribute('data-storage-path'));
                state.images = state.images.filter(i => i.id !== id);
                renderGrid();
            });
        });

        // Add tag
        grid.querySelectorAll('.img-add-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openTagInput(btn.getAttribute('data-image-id'));
            });
        });

        // Remove tag
        grid.querySelectorAll('.img-tag-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-image-id');
                const tag = btn.getAttribute('data-tag');
                const img = state.images.find(i => i.id === id);
                if (!img) return;
                img.tags = img.tags.filter(t => t !== tag);
                await updateImageTags(id, img.tags);
                renderGrid();
            });
        });
    }

    // ── Tag input ──
    function openTagInput(imageId) {
        const row   = root.querySelector(`#tag-input-row-${imageId}`);
        const input = root.querySelector(`#tag-input-${imageId}`);
        if (!row || !input) return;
        row.style.display = 'flex';
        input.focus();
        const img = state.images.find(i => i.id === imageId);

        const onInput = () => showSuggestions(imageId, input.value, img?.tags || []);
        const onKey = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = input.value.trim().toLowerCase().replace(/\s+/g, '-');
                if (tag && img && !img.tags.includes(tag)) {
                    img.tags = [...img.tags, tag];
                    await updateImageTags(imageId, img.tags);
                    if (!state.allTags.includes(tag)) state.allTags.push(tag);
                    renderGrid();
                } else { input.value = ''; }
            }
            if (e.key === 'Escape') { row.style.display = 'none'; hideSuggestions(imageId); }
        };
        const onBlur = () => setTimeout(() => { if (row.isConnected) { row.style.display = 'none'; hideSuggestions(imageId); } }, 180);

        input.addEventListener('input', onInput);
        input.addEventListener('keydown', onKey);
        input.addEventListener('blur', onBlur);
    }

    function showSuggestions(imageId, query, currentTags) {
        const box = root.querySelector(`#tag-suggestions-${imageId}`);
        if (!box) return;
        const q = query.trim().toLowerCase();
        const matches = state.allTags.filter(t => !currentTags.includes(t) && (q === '' || t.includes(q))).slice(0, 8);
        const createItem = (q && !state.allTags.includes(q) && !currentTags.includes(q))
            ? `<div class="tag-suggestion-item tag-suggestion-new" data-tag="${q}">+ Criar "<strong>${q}</strong>"</div>` : '';
        if (!createItem && !matches.length) { box.style.display = 'none'; return; }
        box.innerHTML = createItem + matches.map(t => `<div class="tag-suggestion-item" data-tag="${t}">${t}</div>`).join('');
        box.style.display = 'block';
        box.querySelectorAll('.tag-suggestion-item').forEach(item => {
            item.addEventListener('mousedown', async (e) => {
                e.preventDefault();
                const tag = item.getAttribute('data-tag');
                const img = state.images.find(i => i.id === imageId);
                if (img && !img.tags.includes(tag)) {
                    img.tags = [...img.tags, tag];
                    await updateImageTags(imageId, img.tags);
                    if (!state.allTags.includes(tag)) state.allTags.push(tag);
                    renderGrid();
                }
            });
        });
    }

    function hideSuggestions(imageId) {
        const box = root.querySelector(`#tag-suggestions-${imageId}`);
        if (box) box.style.display = 'none';
    }

    // ── Lightbox ──
    const lightbox  = root.querySelector('#img-lightbox');
    const lbImg     = root.querySelector('#lightbox-img');
    const lbTags    = root.querySelector('#lightbox-tags');
    const lbCounter = root.querySelector('#lightbox-counter');

    function openLightbox(index) {
        state.lightboxIndex = index;
        lightbox.style.display = 'flex';
        updateLightbox();
        document.addEventListener('keydown', onLbKey);
    }
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.removeEventListener('keydown', onLbKey);
    }
    function updateLightbox() {
        const img = state.images[state.lightboxIndex];
        if (!img) return;
        lbImg.src = img.public_url;
        lbImg.alt = img.filename;
        lbTags.innerHTML = (img.tags || []).map(t => tagPillHtml(t)).join('');
        lbCounter.textContent = `${state.lightboxIndex + 1} / ${state.images.length}`;
        root.querySelector('#lightbox-prev').style.opacity = state.lightboxIndex > 0 ? '1' : '0.2';
        root.querySelector('#lightbox-next').style.opacity = state.lightboxIndex < state.images.length - 1 ? '1' : '0.2';
    }
    function onLbKey(e) {
        if (e.key === 'ArrowLeft'  && state.lightboxIndex > 0) { state.lightboxIndex--; updateLightbox(); }
        if (e.key === 'ArrowRight' && state.lightboxIndex < state.images.length - 1) { state.lightboxIndex++; updateLightbox(); }
        if (e.key === 'Escape') closeLightbox();
    }

    root.querySelector('#lightbox-close').addEventListener('click', closeLightbox);
    root.querySelector('#lightbox-backdrop').addEventListener('click', closeLightbox);
    root.querySelector('#lightbox-prev').addEventListener('click', () => { if (state.lightboxIndex > 0) { state.lightboxIndex--; updateLightbox(); } });
    root.querySelector('#lightbox-next').addEventListener('click', () => { if (state.lightboxIndex < state.images.length - 1) { state.lightboxIndex++; updateLightbox(); } });

    await reload();
}
