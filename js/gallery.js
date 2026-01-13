// gallery.js - FINAL STABLE (Visible X + Click Logic)

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// CONSTANTS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

let isInProofMode = false; 

// --- HELPER: AVATAR BLOCKER ---
function isAvatarUrl(url) {
    if (!url) return false;
    const domProfile = document.getElementById('profilePic');
    if (domProfile && domProfile.src && url.includes(domProfile.src)) return true;
    if (url.includes("profile") || url.includes("avatar")) return true;
    return false;
}

export function renderGallery() {
    const pGrid = document.getElementById('pendingGrid');
    const hGrid = document.getElementById('historyGrid');
    
    // PENDING
    const pItems = galleryData.filter(i => (i.status || "").toLowerCase() === 'pending' && i.proofUrl);
    if (pGrid) pGrid.innerHTML = pItems.slice(0, pendingLimit).map(createPendingCardHTML).join('');
    if(document.getElementById('pendingSection')) document.getElementById('pendingSection').style.display = pItems.length > 0 ? 'block' : 'none';
    
    // HISTORY
    const hItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (hGrid) hGrid.innerHTML = hItems.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
    if(document.getElementById('historySection')) document.getElementById('historySection').style.display = (hItems.length > 0 || pItems.length === 0) ? 'block' : 'none';
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = hItems.length > historyLimit ? 'block' : 'none';
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
    if (isAvatarUrl(safeSticker)) safeSticker = null;

    return `
        <div class="gallery-item" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted style="width:100%; height:100%; object-fit:cover; opacity: ${s.includes('rej') ? '0.3' : '0.7'};"></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy" style="opacity: ${s.includes('rej') ? '0.3' : '0.7'};">`
            }
            <img src="${statusSticker}" class="gi-status-sticker" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:70%; height:70%; z-index:10; pointer-events:none;">
            ${safeSticker ? `<img src="${safeSticker}" class="gi-reward-sticker" style="position:absolute; bottom:5px; left:5px; width:30px; height:30px; z-index:10;">` : ''}
        </div>`;
}

export function openHistoryModal(index) {
    const historyItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (!historyItems[index]) return;
    setCurrentHistoryIndex(index);
    const item = historyItems[index];

    // 1. Setup Media
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // 2. Setup Overlay
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        let safeSticker = item.sticker;
        if (isAvatarUrl(safeSticker)) safeSticker = null;
        const stickerHTML = safeSticker ? `<img src="${safeSticker}" style="width:120px; height:120px; object-fit:contain; margin-bottom:15px;">` : "";

        const s = (item.status || "").toLowerCase();
        const statusImg = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
        const statusHTML = `<img src="${statusImg}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; opacity:0.8;">`;

        // We explicitly add the ID 'modalCloseX' to the top right
        overlay.innerHTML = `
            <div id="modalCloseX" onclick="closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:9999; font-family:sans-serif;">×</div>
            
            <div class="theater-content">
                <!-- INFO -->
                <div id="modalInfoView" class="sub-view">
                    ${statusHTML}
                    <div class="m-points-lg">+${item.points || 0} PTS</div>
                    ${stickerHTML}
                </div>

                <!-- FEEDBACK -->
                <div id="modalFeedbackView" class="sub-view hidden">
                    <div class="view-label">QUEEN'S FEEDBACK</div>
                    <div class="theater-text-box">${(item.adminComment || "The Queen has observed your work.").replace(/\n/g, '<br>')}</div>
                </div>

                <!-- TASK -->
                <div id="modalTaskView" class="sub-view hidden">
                    <div class="view-label">ORIGINAL ORDER</div>
                    <div class="theater-text-box">${(item.text || "No description.").replace(/\n/g, '<br>')}</div>
                </div>
            </div>

            <!-- BUTTONS -->
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
    // 1. PRIORITY: If clicking the X or Close Button, ALWAYS Close.
    if (e && (e.target.id === 'modalCloseX' || e.target.classList.contains('btn-close-red'))) {
        document.getElementById('glassModal').classList.remove('active');
        document.getElementById('modalMediaContainer').innerHTML = "";
        return;
    }

    // 2. If in Proof Mode (Clean) and NOT clicking X, Restore Menu
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay && overlay.classList.contains('clean')) {
        toggleHistoryView('info'); 
        return;
    }

    // 3. Default Background Click -> Restore to Info View or Close?
    // Based on user request "Click anywhere", usually restores menu if hidden, 
    // but if menu is visible, it does nothing or closes.
    // Let's assume clicks outside content area close it, but here we cover screen.
    // So usually only the Close button or X should close.
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
            if (diff > 0) openHistoryModal(currentHistoryIndex + 1);
            else openHistoryModal(currentHistoryIndex - 1);
        }
    }, { passive: true });
}
