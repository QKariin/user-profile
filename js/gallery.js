// gallery.js - TRILOGY SPLIT DISPLAY

import { 
    galleryData, currentHistoryIndex, touchStartX, 
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

// --- HELPER: GET GLOBAL SORTED LIST ---
// (Used by Modal to find the right item when clicked)
function getSortedGallery() {
    if (!galleryData) return [];
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- MAIN RENDERER (The Trilogy Split) ---
export function renderGallery() {
    if (!galleryData) return;

    // 1. Get Containers
    const gridPerfect = document.getElementById('gridPerfect');
    const gridFailed = document.getElementById('gridFailed');
    const gridOkay = document.getElementById('gridOkay');

    // Safety Check
    if (!gridPerfect || !gridFailed || !gridOkay) return;

    // 2. Clear Previous
    gridPerfect.innerHTML = "";
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    // 3. Sort & Normalize
    const sortedData = getSortedGallery();

    sortedData.forEach((item, index) => {
        // Skip items with no image
        let url = item.proofUrl || item.media || item.file;
        if (!url) return;
        
        let thumb = getOptimizedUrl(url, 300);
        let pts = getPoints(item);
        let status = (item.status || "").toLowerCase();
        let isRejected = status.includes('rej') || status.includes('fail');
        let isPending = status.includes('pending');

        // 4. INJECT HTML BASED ON TIER
        
        // --- TIER 1: THE VAULT (FAILED) ---
        if (isRejected) {
            gridFailed.innerHTML += `
                <div class="item-safe" onclick="window.openHistoryModal(${index})">
                    <div class="safe-glass"><img src="${thumb}"></div>
                    <div class="safe-handle"></div>
                </div>`;
        }
        
        // --- TIER 3: THE PERGAMENT (PERFECT > 145 PTS) ---
        else if (pts > 145) {
            gridPerfect.innerHTML += `
                <div class="item-scroll" onclick="window.openHistoryModal(${index})">
                    <div class="roller-top"></div>
                    <div class="scroll-paper"><img src="${thumb}"></div>
                    <div class="roller-bot"></div>
                </div>`;
        }
        
        // --- TIER 2: THE BLUEPRINT (STANDARD & PENDING) ---
        else {
            const pendingOverlay = isPending ? 
                `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:cyan; font-family:'Orbitron'; font-size:0.6rem; background:rgba(0,20,30,0.6);">ANALYZING</div>` 
                : ``;

            gridOkay.innerHTML += `
                <div class="item-blueprint" onclick="window.openHistoryModal(${index})">
                    <img src="${thumb}">
                    <div class="bp-corner bl-tl"></div><div class="bp-corner bl-tr"></div>
                    <div class="bp-corner bl-bl"></div><div class="bp-corner bl-br"></div>
                    ${pendingOverlay}
                </div>`;
        }
    });
}

// --- MODAL LOGIC (DOSSIER STYLE) ---

export function openHistoryModal(index) {
    const items = getSortedGallery();
    const item = items[index];
    if (!item) return;
    
    setCurrentHistoryIndex(index);

    // Setup Media
    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    // Setup Dossier Overlay
    const overlay = document.getElementById('modalGlassOverlay');
    if (overlay) {
        const pts = getPoints(item);
        const s = (item.status || "").toLowerCase();
        const isRejected = s.includes('rej');
        const isPending = s.includes('pending');
        
        // Sticker Logic
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

        // Footer Button Logic (Redemption)
        let footerAction = `<button onclick="event.stopPropagation(); window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE FILE</button>`;
        if (isRejected) {
            footerAction = `<button onclick="event.stopPropagation(); window.atoneForTask(${index})" class="btn-dim" style="grid-column: span 2; border-color:var(--neon-red); color:var(--neon-red);">ATONE (-100 🪙)</button>`;
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
    // Update Coin UI
    const coinEl = document.getElementById('coins');
    if(coinEl) coinEl.innerText = gameStats.coins;

    // Restore Task
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

// --- STANDARD VIEW HELPERS ---
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

export function openModal() {} // Legacy stub
export function loadMoreHistory() {
    // With horizontal scroll, we typically just load more into the arrays
    // But for this layout, we just render what we have
    renderGallery();
}

// FORCE EXPORT
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.toggleHistoryView = toggleHistoryView;
window.closeModal = closeModal;
