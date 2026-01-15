
// gallery.js - THE TRILOGY (Triptych / Aperture / Vault)

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX,
    gameStats, setGameStats, setCurrentTask, setPendingTaskState, setIgnoreBackendUpdates
} from './state.js';
import { getOptimizedUrl, cleanHTML, triggerSound } from './utils.js';

// STICKERS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

// --- HELPER: POINTS ---
function getPoints(item) {
    let val = item.points || item.score || item.value || item.amount || item.reward || 0;
    return Number(val);
}

// --- HELPER: SORTED LIST ---
function getSortedGallery() {
    if (!galleryData) return [];
    // Sort by Date (Newest First)
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- MAIN RENDERER ---
export function renderGallery() {
    if (!galleryData) return;

    // Get Containers
    const gridPerfect = document.getElementById('gridPerfect'); // Top (Triptych)
    const gridFailed = document.getElementById('gridFailed');   // Bottom (Vaults)
    const gridOkay = document.getElementById('gridOkay');       // Middle (Apertures)

    // Safety
    if (!gridPerfect || !gridFailed || !gridOkay) return;

    // Clear
    gridPerfect.innerHTML = "";
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const sortedData = getSortedGallery();
    
    // Buckets
    let perfectItems = [];
    let failedItems = [];
    let okayItems = [];

    // 1. SORT INTO BUCKETS
    sortedData.forEach((item, index) => {
        let url = item.proofUrl || item.media || item.file;
        if (!url) return;
        
        item.globalIndex = index; // Save index for modal
        
        let pts = getPoints(item);
        let status = (item.status || "").toLowerCase();
        let isRejected = status.includes('rej') || status.includes('fail');

        if (isRejected) {
            failedItems.push(item);
        } else if (pts > 145) {
            perfectItems.push(item);
        } else {
            okayItems.push(item);
        }
    });

    // 2. RENDER BOTTOM: THE VAULT (FAILED)
    failedItems.forEach(item => {
        let thumb = getOptimizedUrl(item.proofUrl || item.media || item.file, 300);
        gridFailed.innerHTML += `
            <div class="item-vault" onclick="window.openHistoryModal(${item.globalIndex})">
                <div class="vault-bolt vb-tl"></div><div class="vault-bolt vb-tr"></div>
                <div class="vault-bolt vb-bl"></div><div class="vault-bolt vb-br"></div>
                <div class="vault-led"></div>
                <div class="vault-bar"><div class="vault-cog"></div></div>
                <img src="${thumb}" class="vault-img">
            </div>`;
    });

    // 3. RENDER MIDDLE: THE APERTURE (OKAY/PENDING)
    okayItems.forEach(item => {
        let thumb = getOptimizedUrl(item.proofUrl || item.media || item.file, 300);
        let isPending = (item.status || "").toLowerCase().includes('pending');
        gridOkay.innerHTML += `
            <div class="item-aperture" onclick="window.openHistoryModal(${item.globalIndex})">
                <div class="shutter-mech">
                    <div class="blade b1"></div><div class="blade b2"></div>
                    <div class="blade b3"></div><div class="blade b4"></div>
                    <div class="blade b5"></div><div class="blade b6"></div>
                </div>
                <img src="${thumb}" class="aperture-img">
                ${isPending ? '<div style="position:absolute; inset:0; z-index:20; display:flex; align-items:center; justify-content:center; color:cyan; font-family:Orbitron; font-size:0.6rem; pointer-events:none;">WAIT</div>' : ''}
            </div>`;
    });

    // 4. RENDER TOP: THE GOLDEN TRIPTYCH (ELITE)
    if (perfectItems.length > 0) {
        let html = `<div class="triptych-stage">`;
        
        // LEFT SAINT (2nd Best)
        if (perfectItems[1]) {
            let thumb = getOptimizedUrl(perfectItems[1].proofUrl || perfectItems[1].media, 300);
            html += `
            <div class="trip-card trip-side" onclick="window.openHistoryModal(${perfectItems[1].globalIndex})">
                <img src="${thumb}" class="trip-img">
                <div class="trip-inner-frame"></div>
                <div class="trip-plaque">+${getPoints(perfectItems[1])}</div>
            </div>`;
        }

        // CENTER IDOL (The Best/Newest)
        if (perfectItems[0]) {
            let thumb = getOptimizedUrl(perfectItems[0].proofUrl || perfectItems[0].media, 300);
            html += `
            <div class="trip-card trip-center" onclick="window.openHistoryModal(${perfectItems[0].globalIndex})">
                <img src="${thumb}" class="trip-img">
                <div class="trip-inner-frame"></div>
                <div class="trip-plaque">+${getPoints(perfectItems[0])}</div>
            </div>`;
        }

        // RIGHT SAINT (3rd Best)
        if (perfectItems[2]) {
            let thumb = getOptimizedUrl(perfectItems[2].proofUrl || perfectItems[2].media, 300);
            html += `
            <div class="trip-card trip-side" onclick="window.openHistoryModal(${perfectItems[2].globalIndex})">
                <img src="${thumb}" class="trip-img">
                <div class="trip-inner-frame"></div>
                <div class="trip-plaque">+${getPoints(perfectItems[2])}</div>
            </div>`;
        }

        html += `</div>`;
        gridPerfect.innerHTML = html;
    }
}

// --- MODAL LOGIC (DOSSIER STYLE) ---

export function openHistoryModal(index) {
    const items = getSortedGallery();
    const item = items[index];
    if (!item) return;
    
    setCurrentHistoryIndex(index);

    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
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
            footerAction = `<button onclick="event.stopPropagation(); window.atoneForTask(${index})" class="btn-dim" style="grid-column: span 2; border-color:var(--neon-red); color:var(--neon-red); width:100%;">ATONE (-100 🪙)</button>`;
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

// --- REDEMPTION LOGIC ---
window.atoneForTask = function(index) {
    const items = getSortedGallery();
    const task = items[index];
    if (!task) return;

    if (gameStats.coins < 100) {
        triggerSound('sfx-deny');
        alert("Insufficient Capital. You need 100 coins to atone.");
        return;
    }

    triggerSound('coinSound');
    setGameStats({ ...gameStats, coins: gameStats.coins - 100 });
    const coinEl = document.getElementById('coins');
    if(coinEl) coinEl.innerText = gameStats.coins;

    const restoredTask = { text: task.text, category: 'redemption', timestamp: Date.now() };
    setCurrentTask(restoredTask);
    
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: restoredTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    window.closeModal(); 
    
    // Switch to Active UI
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

export function openModal() {} 

export function loadMoreHistory() {
    renderGallery();
}

export function initModalSwipeDetection() {
    // Swipe logic can be re-added here if needed
}

// FORCE WINDOW EXPORTS
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
window.atoneForTask = window.atoneForTask;
window.loadMoreHistory = loadMoreHistory;
