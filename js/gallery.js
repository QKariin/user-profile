// gallery.js - FULL RESTORED & FUNCTIONAL

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState, setIgnoreBackendUpdates
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

let activeStickerFilter = "ALL"; 

// --- HELPER: POINTS ---
// Finds points regardless of what the database calls them
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: GET LISTS ---

// 1. Get ALL items sorted by Points (Highest First) - Used for Altar
function getAllByPoints() {
    if (!galleryData) return [];
    return [...galleryData].filter(i => (i.proofUrl || i.media || i.file)).sort((a, b) => getPoints(b) - getPoints(a));
}

// 2. Get Grid items sorted by Date (Newest First) - Used for Archive
function getGridByDate() {
    if (!galleryData) return [];
    
    // Filter out items that don't have images
    let items = galleryData.filter(i => (i.proofUrl || i.media || i.file));

    // Apply Filter Bar Logic
    if (activeStickerFilter === "DENIED") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('rej'));
    } else if (activeStickerFilter === "PENDING") {
        items = items.filter(item => (item.status || "").toLowerCase().includes('pending'));
    } else if (activeStickerFilter !== "ALL") {
        items = items.filter(item => item.sticker === activeStickerFilter);
    }
    
    // Date Sort
    return items.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- MAIN RENDERER ---
export function renderGallery() {
    if (!galleryData) return;

    const altarContainer = document.getElementById('altarSection');
    const altarStage = document.getElementById('altarStage');
    const hGrid = document.getElementById('historyGrid');
    
    // Safety check to prevent profile crash
    if (!hGrid) return;

    // --- 1. RENDER ALTAR (TOP 3 HIGHEST POINTS) ---
    // Only show Altar if we are in "ALL" filter mode
    if (activeStickerFilter === 'ALL') {
        const eliteItems = getAllByPoints().slice(0, 3);
        
        if (eliteItems.length > 0 && altarStage) {
            if (altarContainer) altarContainer.style.display = 'flex';
            let html = "";
            
            // Left (2nd Best)
            if (eliteItems[1]) {
                html += createTriptychHTML(eliteItems[1], "trip-side");
            }
            // Center (The Best)
            if (eliteItems[0]) {
                html += createTriptychHTML(eliteItems[0], "trip-center");
            }
            // Right (3rd Best)
            if (eliteItems[2]) {
                html += createTriptychHTML(eliteItems[2], "trip-side");
            }
            altarStage.innerHTML = html;
        } else if (altarContainer) {
            altarContainer.style.display = 'none';
        }
    } else if (altarContainer) {
        // Hide Altar if filtering
        altarContainer.style.display = 'none';
    }

    // --- 2. RENDER MAIN GRID (ARCHIVE) ---
    renderStickerFilters();
    
    const displayItems = getGridByDate();

    if (hGrid) {
        hGrid.innerHTML = displayItems.slice(0, historyLimit).map((item) => {
            // Find global index for Modal consistency
            const realIndex = galleryData.indexOf(item); 
            return createGalleryItemHTML(item, realIndex);
        }).join('');
        
        hGrid.style.display = 'grid';
    }
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = (displayItems.length > historyLimit) ? 'block' : 'none';
}

// --- HTML GENERATORS ---

function createTriptychHTML(item, cssClass) {
    let url = item.proofUrl || item.media || item.file;
    const thumb = getOptimizedUrl(url, 300);
    const realIndex = galleryData.indexOf(item);
    
    return `
        <div class="trip-card ${cssClass}" onclick="window.openHistoryModal(${realIndex})">
            <img src="${thumb}" class="trip-img">
            <div class="trip-inner"></div>
            <div class="trip-plaque">+${getPoints(item)}</div>
        </div>`;
}

function createGalleryItemHTML(item, index) {
    let url = item.proofUrl || item.media || item.file;
    let thumbUrl = getOptimizedUrl(url, 300);
    const s = (item.status || "").toLowerCase();
    
    const isPending = s.includes('pending');
    const isRejected = s.includes('rej') || s.includes('fail');
    const pts = getPoints(item);

    // Tier Logic for Borders
    let tierClass = "item-tier-silver";
    if (isPending) tierClass = "item-tier-pending";
    else if (isRejected) tierClass = "item-tier-denied";
    else if (pts >= 50) tierClass = "item-tier-gold";

    // Text Label
    let barText = `+${pts}`;
    if (isPending) barText = "WAIT";
    if (isRejected) barText = "DENIED";

    const isVideo = (url || "").match(/\.(mp4|webm|mov)($|\?)/i);

    return `
        <div class="gallery-item ${tierClass}" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy">`
            }

            ${isPending ? `<div class="pending-overlay"><div class="pending-icon">⏳</div></div>` : ''}
            
            <div class="merit-tag">
                <div class="tag-label">MERIT</div>
                <div class="tag-val">${barText}</div>
            </div>
        </div>`;
}

function renderStickerFilters() {
    const filterBar = document.getElementById('stickerFilterBar');
    if (!filterBar || !galleryData) return;

    // Collect Unique Stickers from history
    const stickers = new Set();
    galleryData.forEach(item => {
        if (item.sticker && item.sticker.length > 10) stickers.add(item.sticker);
    });

    let html = `
        <div class="filter-circle ${activeStickerFilter === 'ALL' ? 'active' : ''}" onclick="window.setGalleryFilter('ALL')">
            <span class="filter-all-text">ALL</span>
        </div>
        <div class="filter-circle ${activeStickerFilter === 'PENDING' ? 'active' : ''}" onclick="window.setGalleryFilter('PENDING')" style="${activeStickerFilter === 'PENDING' ? 'border-color:var(--neon-yellow);' : ''}">
            <span class="filter-all-text" style="color:var(--neon-yellow); font-size:0.5rem;">WAIT</span>
        </div>
        <div class="filter-circle ${activeStickerFilter === 'DENIED' ? 'active' : ''}" onclick="window.setGalleryFilter('DENIED')" style="${activeStickerFilter === 'DENIED' ? 'border-color:var(--neon-red);' : ''}">
            <span class="filter-all-text" style="color:var(--neon-red); font-size:0.5rem;">DENY</span>
        </div>`;

    stickers.forEach(url => {
        if(url === STICKER_DENIED) return;
        const isActive = (activeStickerFilter === url) ? 'active' : '';
        html += `
            <div class="filter-circle ${isActive}" onclick="window.setGalleryFilter('${url}')">
                <img src="${url}">
            </div>`;
    });

    filterBar.innerHTML = html;
}


// --- MODAL LOGIC (DOSSIER STYLE) ---

export function openHistoryModal(index) {
    // Use direct galleryData access since index is global now
    const item = galleryData[index];
    if (!item) return;
    
    setCurrentHistoryIndex(index);

    let url = item.proofUrl || item.media || item.file;
    const isVideo = (url || "").match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        const pts = getPoints(item);
        const s = (item.status || "").toLowerCase();
        const isRejected = s.includes('rej') || s.includes('fail');
        const isPending = s.includes('pending');
        
        let statusImg = "";
        let statusText = "SYSTEM VERDICT";
        
        if (isPending) {
            statusText = "AWAITING REVIEW";
        } else {
            statusImg = s.includes('app') ? STICKER_APPROVE : (isRejected ? STICKER_DENIED : "");
        }

        const statusDisplay = isPending 
            ? `<div style="font-size:3rem;">⏳</div>` 
            : `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

        let footerAction = `<button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE FILE</button>`;
        
        if (isRejected) {
            footerAction = `<button onclick="event.stopPropagation(); window.atoneForTask(${index})" class="btn-skip-small" style="grid-column: span 2; border-color:var(--neon-red); color:var(--neon-red); width:100%;">ATONE (-100 🪙)</button>`;
        }

        overlay.innerHTML = `
            <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:110;">×</div>
            
            <div class="theater-content dossier-layout">
                <div class="dossier-sidebar">
                    <div id="modalInfoView" class="sub-view">
                        <div class="dossier-block">
                            <div class="dossier-label">${statusText}</div>
                            ${statusDisplay}
                        </div>
                        <div class="dossier-block">
                            <div class="dossier-label">MERIT VALUE</div>
                            <div class="m-points-lg" style="color:${isRejected ? 'red' : (isPending ? 'cyan' : 'gold')}">
                                ${isPending ? "CALCULATING" : "+" + pts}
                            </div>
                        </div>
                    </div>

                    <div id="modalFeedbackView" class="sub-view hidden">
                        <div class="dossier-label">OFFICER NOTES</div>
                        <div class="theater-text-box">${(item.adminComment || "No notes.").replace(/\n/g, '<br>')}</div>
                    </div>
                    
                    <div id="modalTaskView" class="sub-view hidden">
                         <div class="dossier-label">DIRECTIVE</div>
                         <div class="theater-text-box">${(item.text || "").replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            </div>

            <div class="modal-footer-menu">
                <button onclick="event.stopPropagation(); window.toggleHistoryView('feedback')" class="history-action-btn">NOTES</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('task')" class="history-action-btn">ORDER</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('proof')" class="history-action-btn">EVIDENCE</button>
                <button onclick="event.stopPropagation(); window.toggleHistoryView('info')" class="history-action-btn">DATA</button>
                ${footerAction}
            </div>
        `;
    }

    toggleHistoryView('info');
    document.getElementById('glassModal').classList.add('active');
}

// --- REDEMPTION ---
window.atoneForTask = function(index) {
    const item = galleryData[index];
    if (!item) return;

    if (gameStats.coins < 100) {
        triggerSound('sfx-deny');
        alert("Insufficient Capital.");
        return;
    }

    triggerSound('coinSound');
    setGameStats({ ...gameStats, coins: gameStats.coins - 100 });
    const coinEl = document.getElementById('coins');
    if(coinEl) coinEl.innerText = gameStats.coins;

    const restoredTask = { text: item.text, category: 'redemption', timestamp: Date.now() };
    setCurrentTask(restoredTask);
    
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: restoredTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    window.closeModal(); 
    
    // Switch to active view
    if(window.restorePendingUI) window.restorePendingUI();
    if(window.updateTaskUIState) window.updateTaskUIState(true);
    if(window.toggleTaskDetails) window.toggleTaskDetails(true);

    window.parent.postMessage({ 
        type: "PURCHASE_ITEM", 
        itemName: "Redemption",
        cost: 100,
        messageToDom: "Slave paid 100 coins to retry failed task." 
    }, "*");
    
    window.parent.postMessage({ 
        type: "savePendingState", 
        pendingState: newPendingState, 
        consumeQueue: false 
    }, "*");
};

// --- VIEW HELPERS ---
export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

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

// REQUIRED EXPORT for main.js
export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

export function openModal() {} 
export function initModalSwipeDetection() {
    const modalEl = document.getElementById('glassModal');
    if (!modalEl) return;
    modalEl.addEventListener('touchstart', e => setTouchStartX(e.changedTouches[0].screenX), { passive: true });
    modalEl.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 80) {
            let nextIndex = currentHistoryIndex;
            if (diff > 0) nextIndex++; 
            else nextIndex--; 
            if (nextIndex >= 0 && nextIndex < galleryData.length) {
                openHistoryModal(nextIndex);
            }
        }
    }, { passive: true });
}

// FORCE WINDOW EXPORTS
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.atoneForTask = window.atoneForTask;
window.loadMoreHistory = loadMoreHistory;
window.setGalleryFilter = function(filterType) {
    activeStickerFilter = filterType;
    renderGallery(); 
};
