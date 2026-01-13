// gallery.js - WITH PENDING FILTER

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { getOptimizedUrl, cleanHTML } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

let activeStickerFilter = "ALL"; 

// --- HELPER: RENDER FILTERS ---
function renderStickerFilters() {
    const filterBar = document.getElementById('stickerFilterBar');
    if (!filterBar || !galleryData) return;

    // Collect Unique Stickers
    const stickers = new Set();
    galleryData.forEach(item => {
        if (item.sticker && item.sticker.length > 10) {
            stickers.add(item.sticker);
        }
    });

    // 1. ALL BUTTON
    let html = `
        <div class="filter-circle ${activeStickerFilter === 'ALL' ? 'active' : ''}" onclick="window.setGalleryFilter('ALL')">
            <span class="filter-all-text">ALL</span>
        </div>`;

    // 2. PENDING BUTTON (Yellow)
    html += `
        <div class="filter-circle ${activeStickerFilter === 'PENDING' ? 'active' : ''}" onclick="window.setGalleryFilter('PENDING')" style="${activeStickerFilter === 'PENDING' ? 'border-color:var(--neon-yellow);' : ''}">
            <span class="filter-all-text" style="color:var(--neon-yellow); font-size:0.5rem;">WAIT</span>
        </div>`;

    // 3. STICKER BUTTONS
    stickers.forEach(url => {
        const isActive = (activeStickerFilter === url) ? 'active' : '';
        html += `
            <div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')">
                <img src="${url}">
            </div>`;
    });

    filterBar.innerHTML = html;
}

// Global Filter Setter
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};

export function renderGallery() {
    const pGrid = document.getElementById('pendingGrid');
    const hGrid = document.getElementById('historyGrid');
    const pSection = document.getElementById('pendingSection');
    const hSection = document.getElementById('historySection');
    
    // Render Filters
    renderStickerFilters();

    // --- 1. PENDING LOGIC ---
    // Only show pending if filter is ALL or PENDING
    const showPending = (activeStickerFilter === 'ALL' || activeStickerFilter === 'PENDING');
    
    const pItems = galleryData.filter(i => (i.status || "").toLowerCase() === 'pending' && i.proofUrl);
    
    if (pGrid) pGrid.innerHTML = pItems.slice(0, pendingLimit).map(createPendingCardHTML).join('');
    
    if (pSection) {
        // Show section if we are allowed to see it AND there are items
        pSection.style.display = (showPending && pItems.length > 0) ? 'block' : 'none';
    }
    
    // --- 2. HISTORY LOGIC ---
    // Only show history if filter is ALL or a specific STICKER (Not PENDING)
    const showHistory = (activeStickerFilter !== 'PENDING');

    let hItems = getSortedHistoryItems();

    // Apply Sticker Filter
    if (activeStickerFilter !== "ALL" && activeStickerFilter !== "PENDING") {
        hItems = hItems.filter(item => item.sticker === activeStickerFilter);
    }

    if (hGrid) hGrid.innerHTML = hItems.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
    
    // Toggle History Visibility
    // Note: We hide the entire History Section if "PENDING" is clicked to focus on pending items
    // But we keep it visible if "ALL" is clicked, or if a sticker is clicked.
    // However, if the filtered list is empty, we might hide it too.
    const shouldShowHistory = showHistory && (hItems.length > 0 || activeStickerFilter !== "PENDING");
    
    // Actually, if PENDING is selected, we hide history completely.
    // If ALL is selected, we show both.
    // If Sticker is selected, we show History (filtered) and hide Pending.
    
    // Apply visibility logic
    if (hGrid) {
        hGrid.style.display = showHistory ? 'grid' : 'none';
        // We don't hide the whole section wrapper because it holds the filter bar!
        // We just hide the grid or show a "No items" message if needed.
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (showHistory && hItems.length > historyLimit) ? 'block' : 'none';
}

function getSortedHistoryItems() {
    if (!galleryData) return [];
    const items = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });
    return items.sort((a, b) => {
        const pointsA = Number(a.points) || 0;
        const pointsB = Number(b.points) || 0;
        if (pointsB !== pointsA) return pointsB - pointsA;
        return new Date(b._createdDate) - new Date(a._createdDate);
    });
}

export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

function createPendingCardHTML(item) {
    const cleanText = cleanHTML(item.text).replace(/"/g, '&quot;');
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)$/i);
    let thumb = getOptimizedUrl(item.proofUrl, 400);
    const encUrl = encodeURIComponent(item.proofUrl || "");
    const encText = encodeURIComponent(item.text || "");
    
    return `<div class="pending-card" onclick='window.openModal("${encUrl}", "PENDING", "${encText}", ${isVideo ? true : false})'>
                <div class="pc-media">
                    ${isVideo 
                        ? `<video src="${thumb}" class="pc-thumb" muted style="object-fit:cover;"></video>` 
                        : `<img src="${thumb}" class="pc-thumb" loading="lazy">`
                    }
                </div>
                <div class="pc-content"><div class="pc-badge">PENDING</div><div class="pc-title">${cleanText}</div></div>
            </div>`;
}

function createGalleryItemHTML(item, index) {
    let thumbUrl = getOptimizedUrl(item.proofUrl, 300);
    const s = (item.status || "").toLowerCase();
    const statusSticker = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);

    let safeSticker = item.sticker;
    if (safeSticker && (safeSticker.includes("profile") || safeSticker.includes("avatar"))) safeSticker = null;
    
    // Points Badge
    const pts = item.points || 0;

    return `
        <div class="gallery-item" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted style="width:100%; height:100%; object-fit:cover; opacity: ${s.includes('rej') ? '0.3' : '0.7'};"></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy" style="opacity: ${s.includes('rej') ? '0.3' : '0.7'};">`
            }
            <img src="${statusSticker}" class="gi-status-sticker" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:70%; height:70%; z-index:10; pointer-events:none;">
            ${safeSticker ? `<img src="${safeSticker}" class="gi-reward-sticker" style="position:absolute; bottom:5px; left:5px; width:30px; height:30px; z-index:10;">` : ''}
            
            <div style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.7); color:var(--gold); font-size:0.6rem; padding:2px 4px; border-radius:2px; font-family:'Orbitron'; font-weight:bold; z-index:20;">
                ${pts}
            </div>
        </div>`;
}

export function openHistoryModal(index) {
    // IMPORTANT: Filter list based on current active filter
    let historyItems = getSortedHistoryItems();
    
    if (activeStickerFilter !== "ALL" && activeStickerFilter !== "PENDING") {
        historyItems = historyItems.filter(item => item.sticker === activeStickerFilter);
    }

    if (!historyItems[index]) return;
    setCurrentHistoryIndex(index);
    const item = historyItems[index];

    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let safeSticker = item.sticker;
        if (safeSticker && (safeSticker.includes("profile") || safeSticker.includes("avatar"))) safeSticker = null;
        const stickerHTML = safeSticker ? `<img src="${safeSticker}" style="width:120px; height:120px; object-fit:contain; margin-bottom:15px;">` : "";

        const s = (item.status || "").toLowerCase();
        const statusImg = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
        const statusHTML = `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:9999;">×</div>
            <div class="theater-content">
                <div id="modalInfoView" class="sub-view">
                    ${statusHTML}
                    <div class="m-points-lg">+${item.points || 0} PTS</div>
                    ${stickerHTML}
                </div>
                <div id="modalFeedbackView" class="sub-view hidden">
                    <div class="view-label">QUEEN'S FEEDBACK</div>
                    <div class="theater-text-box">${(item.adminComment || "The Queen has observed your work.").replace(/\n/g, '<br>')}</div>
                </div>
                <div id="modalTaskView" class="sub-view hidden">
                    <div class="view-label">ORIGINAL ORDER</div>
                    <div class="theater-text-box">${(item.text || "No description.").replace(/\n/g, '<br>')}</div>
                </div>
            </div>
            <div class="modal-footer-menu">
                <button onclick="event.stopPropagation(); toggleHistoryView('feedback')" class="history-action-btn">FEEDBACK</button>
                <button onclick="event.stopPropagation(); toggleHistoryView('task')" class="history-action-btn">THE TASK</button>
                <button onclick="event.stopPropagation(); toggleHistoryView('proof')" class="history-action-btn">SHOW PROOF</button>
                <button onclick="event.stopPropagation(); closeModal(event)" class="history-action-btn btn-close-red">CLOSE</button>
            </div>
        `;
    }
    toggleHistoryView('info');
    document.getElementById('glassModal').classList.add('active');
}

export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    isInProofMode = (view === 'proof');
    const views = ['modalInfoView', 'modalFeedbackView', 'modalTaskView'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });

    if (view === 'proof') {
        modal.classList.add('proof-mode-active');
        overlay.classList.add('clean');
    } else {
        modal.classList.remove('proof-mode-active');
        overlay.classList.remove('clean');
        let targetId = 'modalInfoView';
        if (view === 'feedback') targetId = 'modalFeedbackView';
        if (view === 'task') targetId = 'modalTaskView';
        const target = document.getElementById(targetId);
        if(target) target.classList.remove('hidden');
    }
}

export function closeModal(e) {
    if (e && (e.target.id === 'modalCloseX' || e.target.classList.contains('btn-close-red'))) {
        document.getElementById('glassModal').classList.remove('active');
        document.getElementById('modalMediaContainer').innerHTML = "";
        return;
    }
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay && overlay.classList.contains('clean')) {
        toggleHistoryView('info'); 
        return;
    }
}

export function openModal(url, status, text, isVideo) {
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${decodeURIComponent(url)}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${decodeURIComponent(url)}" style="width:100%; height:100%; object-fit:contain;">`;
    }
    const overlay = document.getElementById('modalGlassOverlay');
    if(overlay) {
        overlay.innerHTML = `
            <div id="modalCloseX" onclick="closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:9999;">×</div>
            <div class="theater-content">
                <div class="m-points-lg" style="color:var(--neon-yellow);">PENDING</div>
                <div class="theater-text-box">${decodeURIComponent(text)}</div>
            </div>
            <div class="modal-footer-menu" style="grid-template-columns: 1fr;">
                <button onclick="closeModal(event)" class="history-action-btn btn-close-red">CLOSE</button>
            </div>
        `;
    }
    document.getElementById('glassModal').classList.add('active');
}

export function initModalSwipeDetection() {
    const modalEl = document.getElementById('glassModal');
    if (!modalEl) return;
    modalEl.addEventListener('touchstart', e => setTouchStartX(e.changedTouches[0].screenX), { passive: true });
    modalEl.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 80) {
            let historyItems = getSortedHistoryItems();
            if (activeStickerFilter !== "ALL" && activeStickerFilter !== "PENDING") {
                historyItems = historyItems.filter(item => item.sticker === activeStickerFilter);
            }
            let nextIndex = currentHistoryIndex;
            if (diff > 0) nextIndex++; 
            else nextIndex--; 
            
            if (nextIndex >= 0 && nextIndex < historyItems.length) {
                openHistoryModal(nextIndex);
            }
        }
    }, { passive: true });
}
