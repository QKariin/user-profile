// gallery.js - FIXED: DATA NORMALIZATION & FIELD MISMATCHES

import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { cleanHTML, triggerSound } from './utils.js';
import { signUpcdnUrl } from './bytescale.js';

// YOUR STICKER LINKS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";

let isInProofMode = false; 

export async function renderGallery() {
    if (!galleryData || !Array.isArray(galleryData)) return;

    // --- STEP 1: NORMALIZE DATA (The Fix for the "Disappearing" Images) ---
    // The backend might send 'media', 'url', 'image', or 'evidence'. 
    // We force them all into 'proofUrl' so the rest of the code works.
    galleryData.forEach(item => {
        if (!item.proofUrl) {
            item.proofUrl = item.media || item.url || item.evidence || item.image || item.fileUrl || "";
        }
        // Normalize Text
        if (!item.text) {
            item.text = item.description || item.caption || item.message || "No description.";
        }
    });

    // --- STEP 2: HANDLE SECURE URLS ---
    const signingPromises = galleryData.map(async (item) => {
        if (item.proofUrl && typeof item.proofUrl === 'string' && item.proofUrl.startsWith("https://upcdn.io/")) {
            try {
                // Try to get thumbnail version first for grid
                item.proofUrlThumb = await signUpcdnUrl(item.proofUrl.replace("/raw/", "/thumbnail/"));
                
                // Get full version
                const signedFull = await signUpcdnUrl(item.proofUrl);
                if (signedFull) item.proofUrl = signedFull; // Only update if signing succeeded
            } catch (e) {
                console.warn("Signing failed for:", item.proofUrl);
            }
        }
    });
    
    // Wait for all URLs to be signed before rendering to prevent "jumping" content
    await Promise.all(signingPromises);

    // --- STEP 3: RENDER GRIDS ---
    const pGrid = document.getElementById('pendingGrid');
    const hGrid = document.getElementById('historyGrid');
    
    // Filter for Pending
    const pItems = galleryData.filter(i => (i.status || "").toLowerCase() === 'pending' && i.proofUrl);
    
    if (pGrid) {
        pGrid.innerHTML = pItems.slice(0, pendingLimit).map(createPendingCardHTML).join('');
    }
    
    const pSection = document.getElementById('pendingSection');
    if (pSection) pSection.style.display = pItems.length > 0 ? 'block' : 'none';
    
    // Filter for History (Approved/Rejected)
    const hItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    if (hGrid) {
        hGrid.innerHTML = hItems.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
    }
    
    const hSection = document.getElementById('historySection');
    if (hSection) hSection.style.display = (hItems.length > 0 || pItems.length === 0) ? 'block' : 'none';
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = hItems.length > historyLimit ? 'block' : 'none';
}

export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}

function createPendingCardHTML(item) {
    const cleanText = cleanHTML(item.text).replace(/"/g, '&quot;');
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    let thumb = item.proofUrlThumb || item.proofUrl;
    
    const encUrl = encodeURIComponent(item.proofUrl || "");
    const encText = encodeURIComponent(item.text || "");
    
    return `<div class="pending-card" onclick='window.openModal("${encUrl}", "PENDING", "${encText}", ${isVideo ? true : false})'>
                <div class="pc-media">
                    ${isVideo 
                        ? `<video src="${thumb}" class="pc-thumb" muted style="object-fit:cover;"></video>` 
                        : `<img src="${thumb}" class="pc-thumb" loading="lazy">`
                    }
                    <div class="pc-gradient"></div>
                    <div style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center;">
                        <svg style="width:30px; height:30px; fill:var(--neon-yellow);"><use href="#icon-timer"></use></svg>
                    </div>
                </div>
                <div class="pc-content"><div class="pc-badge">PENDING</div><div class="pc-title">${cleanText}</div></div>
            </div>`;
}

function createGalleryItemHTML(item, index) {
    let thumbUrl = item.proofUrlThumb || item.proofUrl;
    const s = (item.status || "").toLowerCase();
    const statusSticker = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);

    return `
        <div class="gallery-item" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${thumbUrl}" class="gi-thumb" muted style="width:100%; height:100%; object-fit:cover; opacity: ${s.includes('rej') ? '0.3' : '0.7'};"></video>` 
                : `<img src="${thumbUrl}" class="gi-thumb" loading="lazy" style="opacity: ${s.includes('rej') ? '0.3' : '0.7'};">`
            }
            <img src="${statusSticker}" class="gi-status-sticker" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:70%; height:70%; z-index:10; pointer-events:none;">
            ${item.sticker ? `<img src="${item.sticker}" class="gi-reward-sticker" style="position:absolute; bottom:5px; left:5px; width:30px; height:30px; z-index:10;">` : ''}
        </div>`;
}

export function openHistoryModal(index) {
    // Re-filter to ensure index matches the displayed grid
    const hItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej')) && i.proofUrl;
    });

    // Find the actual item in the filtered list
    // Note: The index passed from HTML is based on the filtered list order
    const item = hItems[index]; 
    if (!item) return;

    setCurrentHistoryIndex(index);

    const isVideo = item.proofUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${item.proofUrl}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${item.proofUrl}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    const pointsEl = document.getElementById('modalPoints');
    if (pointsEl) pointsEl.innerText = `+${item.points || 0} PTS`;

    const stickerEl = document.getElementById('modalStatusSticker');
    if (stickerEl) {
        const s = (item.status || "").toLowerCase();
        stickerEl.src = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    }

    const rewardStickerEl = document.getElementById('modalSticker');
    if (rewardStickerEl) {
        rewardStickerEl.innerHTML = item.sticker ? `<img src="${item.sticker}" style="width:80px; height:80px; object-fit:contain;">` : "";
    }

    const fbText = document.getElementById('modalFeedbackText');
    if (fbText) fbText.innerHTML = (item.adminComment || "The Queen has observed your work.").replace(/\n/g, '<br>');
    
    const taskText = document.getElementById('modalOrderText');
    if (taskText) taskText.innerHTML = (item.text || "No task description.").replace(/\n/g, '<br>');

    toggleHistoryView(isInProofMode ? 'proof' : 'info');
    document.getElementById('glassModal').classList.add('active');
}

export function toggleHistoryView(view) {
    const modal = document.getElementById('glassModal');
    const overlay = document.getElementById('modalGlassOverlay');
    if (!modal || !overlay) return;

    isInProofMode = (view === 'proof');

    const views = {
        info: document.getElementById('modalInfoView'),
        feedback: document.getElementById('modalFeedbackView'),
        task: document.getElementById('modalTaskView')
    };

    Object.values(views).forEach(v => v?.classList.add('hidden'));

    if (view === 'proof') {
        modal.classList.add('proof-mode-active');
        overlay.classList.add('clean');
    } else {
        modal.classList.remove('proof-mode-active');
        overlay.classList.remove('clean');
        if (views[view]) views[view].classList.remove('hidden');
        else if (views.info) views.info.classList.remove('hidden');
    }
}

export function closeModal(e) {
    const overlay = document.getElementById('modalGlassOverlay');
    
    // If we are in "clean" mode (Proof View), clicking anywhere brings back the overlay, unless it's the X
    if (overlay && overlay.classList.contains('clean')) {
        if (e && e.target.id === 'modalCloseX') { 
            // actually close 
        } else { 
            // just restore overlay
            toggleHistoryView('info'); 
            return; 
        }
    }
    
    // Standard closing logic
    if (e && e.target.id !== 'glassModal' && e.target.id !== 'modalCloseX' && !e.target.classList.contains('btn-close-red')) return;

    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        const mediaContainer = document.getElementById('modalMediaContainer');
        if(mediaContainer) mediaContainer.innerHTML = ""; // Stop video playback
    }
}

export function openModal(url, status, text, isVideo) {
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${decodeURIComponent(url)}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${decodeURIComponent(url)}" style="width:100%; height:100%; object-fit:contain;">`;
    }
    
    // Handle status text manually for Pending items
    const statusSticker = document.getElementById('modalStatusSticker');
    if (statusSticker) statusSticker.style.display = 'none'; // Hide sticker for pending
    
    const taskText = document.getElementById('modalOrderText');
    if (taskText) taskText.innerHTML = decodeURIComponent(text).replace(/\n/g, '<br>');

    toggleHistoryView('task');
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
            // Recalculate filtered list to get correct index mapping
            const hItems = galleryData.filter(i => {
                const s = (i.status || "").toLowerCase();
                return (s.includes('app') || s.includes('rej')) && i.proofUrl;
            });
            
            let nextIndex = currentHistoryIndex;
            if (diff > 0) nextIndex++; // Swipe Left -> Next
            else nextIndex--; // Swipe Right -> Prev
            
            // Bounds check
            if (nextIndex >= 0 && nextIndex < hItems.length) {
                openHistoryModal(nextIndex);
            }
        }
    }, { passive: true });
}
