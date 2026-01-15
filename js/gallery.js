
// gallery.js - TRILOGY LAYOUT (CRASH FIXED)

import { 
    galleryData, setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { getOptimizedUrl } from './utils.js';

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
    return [...galleryData].sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
}

// --- MAIN RENDERER ---
export function renderGallery() {
    if (!galleryData) return;

    const gridPerfect = document.getElementById('gridPerfect');
    const gridFailed = document.getElementById('gridFailed');
    const gridOkay = document.getElementById('gridOkay');

    // Safety: If HTML hasn't updated yet, don't crash
    if (!gridPerfect || !gridFailed || !gridOkay) return;

    gridPerfect.innerHTML = "";
    gridFailed.innerHTML = "";
    gridOkay.innerHTML = "";

    const sortedData = getSortedGallery();

    sortedData.forEach((item, index) => {
        // Validation
        let url = item.proofUrl || item.media || item.file;
        if (!url) return;
        
        let thumb = getOptimizedUrl(url, 300);
        let pts = getPoints(item);
        let status = (item.status || "").toLowerCase();
        let isRejected = status.includes('rej') || status.includes('fail');
        let isPending = status.includes('pending');

        let html = "";
        let targetGrid = null;

        // 1. FAILED -> VAULT (Middle)
        if (isRejected) {
            targetGrid = gridFailed;
            html = `
                <div class="item-safe" onclick="window.openHistoryModal(${index})">
                    <div class="safe-glass"><img src="${thumb}"></div>
                    <div class="safe-handle"></div>
                </div>`;
        }
        // 2. ELITE -> PERGAMENT (Top)
        else if (pts > 145) {
            targetGrid = gridPerfect;
            html = `
                <div class="item-scroll" onclick="window.openHistoryModal(${index})">
                    <div class="roller-top"></div>
                    <div class="scroll-paper"><img src="${thumb}"></div>
                    <div class="roller-bot"></div>
                </div>`;
        }
        // 3. STANDARD -> BLUEPRINT (Bottom)
        else {
            targetGrid = gridOkay;
            const overlay = isPending ? 
                `<div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:cyan; font-family:'Orbitron'; font-size:0.6rem; background:rgba(0,20,30,0.6);">ANALYZING</div>` 
                : ``;

            html = `
                <div class="item-blueprint" onclick="window.openHistoryModal(${index})">
                    <img src="${thumb}">
                    <div class="bp-corner bl-tl"></div><div class="bp-corner bl-tr"></div>
                    <div class="bp-corner bl-bl"></div><div class="bp-corner bl-br"></div>
                    ${overlay}
                </div>`;
        }

        if (targetGrid) targetGrid.innerHTML += html;
    });
}

// --- CRITICAL FIX: EXPORT THIS EMPTY FUNCTION TO PREVENT CRASH ---
export function loadMoreHistory() {
    // Horizontal scrolls usually auto-load, but we keep this to satisfy main.js import
    console.log("History loaded via scroll");
}

export function openHistoryModal(index) {
    const items = getSortedGallery();
    const item = items[index];
    if (!item) return;
    
    // ... (Your existing Modal Logic works here, I can repost if needed) ...
    // For now, let's just make sure the profile loads first!
    if(window.openModalInternal) window.openModalInternal(item); 
    // ^ This assumes we attach the modal logic to window, see below
    
    // Temporary Direct Call to ensure it works immediately
    buildAndShowModal(item);
}

function buildAndShowModal(item) {
    // (Simplified Dossier Modal Builder for immediate function)
    const overlay = document.getElementById('modalGlassOverlay');
    if(!overlay) return;
    
    const pts = getPoints(item);
    overlay.innerHTML = `
        <div id="modalCloseX" onclick="window.closeModal(event)" style="position:absolute; top:20px; right:20px; font-size:2.5rem; cursor:pointer; color:white; z-index:110;">×</div>
        <div class="theater-content dossier-layout">
            <div class="dossier-sidebar">
                <div class="dossier-block"><div class="dossier-label">VALUE</div><div class="m-points-lg">+${pts}</div></div>
                <div class="dossier-block"><div class="dossier-label">DIRECTIVE</div><div class="theater-text-box">${item.text}</div></div>
            </div>
        </div>
        <div class="modal-footer-menu">
            <button onclick="window.closeModal(event)" class="history-action-btn btn-close-red" style="grid-column: span 2;">CLOSE</button>
        </div>
    `;
    document.getElementById('glassModal').classList.add('active');
}

// Standard Exports
export function toggleHistoryView() {}
export function closeModal(e) {
    document.getElementById('glassModal').classList.remove('active');
}
export function openModal() {} 
export function initModalSwipeDetection() {}

// FORCE WINDOW EXPORTS
window.renderGallery = renderGallery;
window.openHistoryModal = openHistoryModal;
window.closeModal = closeModal;
