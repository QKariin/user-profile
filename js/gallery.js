import { 
    galleryData, pendingLimit, historyLimit, currentHistoryIndex, touchStartX, 
    setCurrentHistoryIndex, setHistoryLimit, setTouchStartX 
} from './state.js';
import { cleanHTML, triggerSound } from './utils.js';
import { signUpcdnUrl } from './bytescale.js';

// CONSTANTS
const STICKER_APPROVE = "https://static.wixstatic.com/media/ce3e5b_a19d81b7f45c4a31a4aeaf03a41b999f~mv2.png";
const STICKER_DENIED = "https://static.wixstatic.com/media/ce3e5b_63a0c8320e29416896d071d5b46541d7~mv2.png";
const PLACEHOLDER_IMG = "https://static.wixstatic.com/media/ce3e5b_1bd27ba758ce465fa89a36d70a68f355~mv2.png"; 

let isInProofMode = false; 

// --- 1. STRICT DATA CLEANING ---
function normalizeGalleryItem(item) {
    // 1. If we have a proofUrl, verify it is NOT the avatar
    if (item.proofUrl) {
        if (item.proofUrl.includes("profile") || item.proofUrl.includes("avatar")) {
            item.proofUrl = ""; // Kill it immediately
        }
    }

    // 2. If no proofUrl, look ONLY at these specific fields.
    // I have REMOVED the loop that scans the whole object. 
    // This prevents it from accidentally finding 'ownerProfilePic'.
    if (!item.proofUrl) {
        const safeCandidates = [
            item.proof, 
            item.evidence, 
            item.media, 
            item.file, 
            item.fileUrl, 
            item.url,
            item.attachment
        ];

        // Find the first valid string that is NOT an avatar
        const found = safeCandidates.find(val => 
            val && 
            typeof val === 'string' && 
            val.length > 5 && 
            !val.includes("profile") && 
            !val.includes("avatar")
        );

        if (found) {
            item.proofUrl = found;
        }
    }

    // 3. Fallback Description
    if (!item.text) item.text = item.description || "Record entry.";
}

export async function renderGallery() {
    if (!galleryData || !Array.isArray(galleryData)) return;

    // STEP 1: Run the Strict Normalizer
    galleryData.forEach(normalizeGalleryItem);

    // STEP 2: Render Immediately with what we have
    renderGridHTML(); 

    // STEP 3: Handle Security Signing (Background)
    let needsUpdate = false;
    const signingPromises = galleryData.map(async (item) => {
        // Only touch UpCDN urls
        if (item.proofUrl && typeof item.proofUrl === 'string' && item.proofUrl.includes("upcdn.io")) {
            try {
                const rawThumb = item.proofUrl.replace("/raw/", "/thumbnail/");
                const signedThumb = await signUpcdnUrl(rawThumb);
                if (signedThumb) item.proofUrlThumb = signedThumb;

                const signedFull = await signUpcdnUrl(item.proofUrl);
                
                // CRITICAL: Only update if the result is valid and NOT an avatar
                if (signedFull && !signedFull.includes("profile")) {
                    if (item.proofUrl !== signedFull) {
                        item.proofUrl = signedFull;
                        needsUpdate = true;
                    }
                }
            } catch (e) {
                // Fail silently, keep original URL
            }
        }
    });

    await Promise.all(signingPromises);
    if (needsUpdate) {
        renderGridHTML();
    }
}

// --- HTML RENDERER ---
function renderGridHTML() {
    const pGrid = document.getElementById('pendingGrid');
    const hGrid = document.getElementById('historyGrid');
    
    // PENDING ITEMS
    const pItems = galleryData.filter(i => (i.status || "").toLowerCase() === 'pending');
    
    if (pGrid) {
        pGrid.innerHTML = pItems.slice(0, pendingLimit).map(createPendingCardHTML).join('');
    }
    
    const pSection = document.getElementById('pendingSection');
    if (pSection) pSection.style.display = pItems.length > 0 ? 'block' : 'none';

    // HISTORY ITEMS
    const hItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej'));
    });

    if (hGrid) {
        hGrid.innerHTML = hItems.slice(0, historyLimit).map((item, index) => createGalleryItemHTML(item, index)).join('');
    }
    
    const hSection = document.getElementById('historySection');
    if (hSection) hSection.style.display = (hItems.length > 0 || pItems.length === 0) ? 'block' : 'none';
    
    const loadBtn = document.getElementById('loadMoreBtn');
    if (loadBtn) loadBtn.style.display = hItems.length > historyLimit ? 'block' : 'none';
}

function createPendingCardHTML(item) {
    const cleanText = cleanHTML(item.text || "").replace(/"/g, '&quot;');
    // Use Placeholder if proofUrl is missing. NEVER fallback to a random variable.
    const url = item.proofUrlThumb || item.proofUrl || PLACEHOLDER_IMG;
    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);
    
    const encUrl = encodeURIComponent(item.proofUrl || "");
    const encText = encodeURIComponent(item.text || "");
    
    return `<div class="pending-card" onclick='window.openModal("${encUrl}", "PENDING", "${encText}", ${isVideo ? true : false})'>
                <div class="pc-media">
                    ${isVideo 
                        ? `<video src="${url}" class="pc-thumb" muted style="object-fit:cover;"></video>` 
                        : `<img src="${url}" class="pc-thumb" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}'">`
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
    let url = item.proofUrlThumb || item.proofUrl || PLACEHOLDER_IMG;
    if (url === 'undefined') url = PLACEHOLDER_IMG;

    const s = (item.status || "").toLowerCase();
    const statusSticker = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    const isVideo = (item.proofUrl || "").match(/\.(mp4|webm|mov)($|\?)/i);

    // SAFETY CHECK: Sticker cannot be an avatar
    let rewardSticker = item.sticker || "";
    if (rewardSticker.includes("profile") || rewardSticker.includes("avatar")) rewardSticker = "";

    return `
        <div class="gallery-item" onclick='window.openHistoryModal(${index})'>
            ${isVideo 
                ? `<video src="${url}" class="gi-thumb" muted style="width:100%; height:100%; object-fit:cover; opacity: ${s.includes('rej') ? '0.3' : '0.7'};"></video>` 
                : `<img src="${url}" class="gi-thumb" loading="lazy" style="opacity: ${s.includes('rej') ? '0.3' : '0.7'};" onerror="this.src='${PLACEHOLDER_IMG}'">`
            }
            <img src="${statusSticker}" class="gi-status-sticker" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); width:70%; height:70%; z-index:10; pointer-events:none;">
            ${rewardSticker ? `<img src="${rewardSticker}" class="gi-reward-sticker" style="position:absolute; bottom:5px; left:5px; width:30px; height:30px; z-index:10;">` : ''}
        </div>`;
}

// --- MODAL LOGIC ---
export function openHistoryModal(index) {
    const hItems = galleryData.filter(i => {
        const s = (i.status || "").toLowerCase();
        return (s.includes('app') || s.includes('rej'));
    });

    const item = hItems[index]; 
    if (!item) return;

    setCurrentHistoryIndex(index);

    const url = item.proofUrl || PLACEHOLDER_IMG;
    const isVideo = url.match(/\.(mp4|webm|mov)($|\?)/i);
    const mediaContainer = document.getElementById('modalMediaContainer');
    
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${url}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${url}" style="width:100%; height:100%; object-fit:contain;">`;
    }

    if(document.getElementById('modalPoints')) document.getElementById('modalPoints').innerText = `+${item.points || 0} PTS`;

    const stickerEl = document.getElementById('modalStatusSticker');
    if (stickerEl) {
        const s = (item.status || "").toLowerCase();
        stickerEl.src = s.includes('app') ? STICKER_APPROVE : STICKER_DENIED;
    }

    const rewardStickerEl = document.getElementById('modalSticker');
    if (rewardStickerEl) {
        // Double Safety Check
        let safeSticker = item.sticker || "";
        if (safeSticker.includes("profile") || safeSticker.includes("avatar")) safeSticker = "";
        
        rewardStickerEl.innerHTML = safeSticker ? `<img src="${safeSticker}" style="width:80px; height:80px; object-fit:contain;">` : "";
    }

    if(document.getElementById('modalFeedbackText')) document.getElementById('modalFeedbackText').innerHTML = (item.adminComment || "The Queen has observed your work.").replace(/\n/g, '<br>');
    if(document.getElementById('modalOrderText')) document.getElementById('modalOrderText').innerHTML = (item.text || "No task description.").replace(/\n/g, '<br>');

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
    if (overlay && overlay.classList.contains('clean')) {
        if (e && e.target.id === 'modalCloseX') { /* close */ } 
        else { toggleHistoryView('info'); return; }
    }
    
    if (e && e.target.id !== 'glassModal' && e.target.id !== 'modalCloseX' && !e.target.classList.contains('btn-close-red')) return;

    const modal = document.getElementById('glassModal');
    if (modal) {
        modal.classList.remove('active');
        const mediaContainer = document.getElementById('modalMediaContainer');
        if(mediaContainer) mediaContainer.innerHTML = "";
    }
}

export function openModal(url, status, text, isVideo) {
    const mediaContainer = document.getElementById('modalMediaContainer');
    if (mediaContainer) {
        mediaContainer.innerHTML = isVideo 
            ? `<video src="${decodeURIComponent(url)}" autoplay loop muted playsinline style="width:100%; height:100%; object-fit:contain;"></video>`
            : `<img src="${decodeURIComponent(url)}" style="width:100%; height:100%; object-fit:contain;">`;
    }
    
    const statusSticker = document.getElementById('modalStatusSticker');
    if (statusSticker) statusSticker.style.display = 'none';
    
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
            const hItems = galleryData.filter(i => {
                const s = (i.status || "").toLowerCase();
                return (s.includes('app') || s.includes('rej'));
            });
            
            let nextIndex = currentHistoryIndex;
            if (diff > 0) nextIndex++; 
            else nextIndex--; 
            
            if (nextIndex >= 0 && nextIndex < hItems.length) {
                openHistoryModal(nextIndex);
            }
        }
    }, { passive: true });
}

export function loadMoreHistory() {
    setHistoryLimit(historyLimit + 25);
    renderGallery();
}
