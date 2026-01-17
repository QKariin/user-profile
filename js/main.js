// main.js - FIXED: RESTORED UI STATE LOGIC

import { CONFIG, URLS, LEVELS, FUNNY_SAYINGS, STREAM_PASSWORDS } from './config.js';
import { 
    gameStats, stats, userProfile, currentTask, taskDatabase, galleryData, 
    pendingTaskState, taskJustFinished, cooldownInterval, ignoreBackendUpdates, 
    lastChatJson, lastGalleryJson, isInitialLoad, chatLimit, lastNotifiedMessageId, 
    historyLimit, pendingLimit, currentView, resetUiTimer, taskQueue, 
    audioUnlocked, cmsHierarchyData, WISHLIST_ITEMS, lastWorshipTime, 
    currentHistoryIndex, touchStartX, isLocked, COOLDOWN_MINUTES,
    setGameStats, setStats, setUserProfile, setCurrentTask, setTaskDatabase, 
    setGalleryData, setPendingTaskState, setTaskJustFinished, setIgnoreBackendUpdates, 
    setLastChatJson, setLastGalleryJson, setIsInitialLoad, setChatLimit, 
    setLastNotifiedMessageId, setHistoryLimit, setCurrentView, setResetUiTimer, 
    setTaskQueue, setCmsHierarchyData, setWishlistItems, setLastWorshipTime, 
    setCurrentHistoryIndex, setTouchStartX, setIsLocked, setCooldownInterval, setActiveRevealMap, setVaultItems, setCurrentLibraryMedia, setLibraryProgressIndex 
} from './state.js';
import { renderRewardGrid, runTargetingAnimation } from '../profile/kneeling/reward.js';
import { triggerSound, migrateGameStatsToStats } from './utils.js';
import { switchTab, toggleStats, openSessionUI, closeSessionUI, updateSessionCost, toggleSection, renderDomVideos, renderNews, renderWishlist } from './ui.js';
import { getRandomTask, restorePendingUI, finishTask, cancelPendingTask, resetTaskDisplay } from './tasks.js';
import { renderChat, sendChatMessage, handleChatKey, sendCoins, loadMoreChat, openChatPreview, closeChatPreview, forceBottom } from './chat.js';
import { renderGallery, loadMoreHistory, initModalSwipeDetection, closeModal, toggleHistoryView, openHistoryModal, openModal } from './gallery.js';
import { handleEvidenceUpload, handleProfileUpload, handleAdminUpload } from './uploads.js';
import { handleHoldStart, handleHoldEnd, claimKneelReward, updateKneelingStatus } from '../profile/kneeling/kneeling.js';
import { Bridge } from './bridge.js';
import { getOptimizedUrl } from './media.js';

// --- 2. CRITICAL UI FUNCTIONS ---

// Toggle the slide-down panel
window.toggleTaskDetails = function(forceOpen = null) {
    if (window.event) window.event.stopPropagation();

    const panel = document.getElementById('taskDetailPanel');
    const link = document.querySelector('.see-task-link'); 
    const chatBox = document.getElementById('chatBox'); 
    
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    let shouldOpen;

    if (forceOpen === true) {
        shouldOpen = true;
    } else if (forceOpen === false) {
        shouldOpen = false;
    } else {
        shouldOpen = !isOpen; 
    }

    if (shouldOpen) {
        panel.classList.add('open');
        if(chatBox) chatBox.classList.add('focused-task');
        if(link) {
            link.innerHTML = "▲ HIDE DIRECTIVE ▲";
            link.style.opacity = "1"; 
        }
    } else {
        panel.classList.remove('open');
        if(chatBox) chatBox.classList.remove('focused-task');
        if(link) {
            link.innerHTML = "▼ SEE DIRECTIVE ▼";
            link.style.opacity = "1";
        }
    }
};

// --- THIS WAS MISSING: THE STATE SWITCHER ---
window.updateTaskUIState = function(isActive) {
    // 1. STATUS TEXT (Single Element)
    const statusText = document.getElementById('mainStatusText');

    // 2. CENTER CONTENT
    const idleMsg = document.getElementById('idleMessage');
    const timerRow = document.getElementById('activeTimerRow');

    // 3. BUTTONS
    const reqBtn = document.getElementById('mainButtonsArea');
    const uploadArea = document.getElementById('uploadBtnContainer');

    if (isActive) {
        // --- WORKING ---
        if (statusText) {
            statusText.innerText = "WORKING";
            statusText.className = "status-text-lg status-working";
        }
        if (idleMsg) idleMsg.classList.add('hidden');
        if (timerRow) timerRow.classList.remove('hidden');

        if (reqBtn) reqBtn.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('hidden');
        
    } else {
        // --- UNPRODUCTIVE ---
        if (statusText) {
            statusText.innerText = "UNPRODUCTIVE";
            statusText.className = "status-text-lg status-unproductive";
        }
        if (idleMsg) idleMsg.classList.remove('hidden');
        if (timerRow) timerRow.classList.add('hidden');

        if (reqBtn) reqBtn.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');
        
        window.toggleTaskDetails(false);
    }
};

// Global Click Listener (Handles Outside Clicks Only)
document.addEventListener('click', function(event) {
    const card = document.getElementById('taskCard');
    const panel = document.getElementById('taskDetailPanel');
    
    if (event.target.closest('.see-task-link')) return;

    if (panel && panel.classList.contains('open') && card && !card.contains(event.target)) {
        window.toggleTaskDetails(false);
    }
});

// --- 3. INITIALIZATION ---

document.addEventListener('click', () => {
    if (!window.audioUnlocked) {
        ['msgSound', 'coinSound', 'skipSound', 'sfx-buy', 'sfx-deny'].forEach(id => {
            const sound = document.getElementById(id);
            if (sound) {
                const originalVolume = sound.volume;
                sound.volume = 0;
                sound.play().then(() => {
                    sound.pause();
                    sound.currentTime = 0;
                    sound.volume = originalVolume;
                }).catch(e => console.log("Audio Engine Ready"));
            }
        });
        window.audioUnlocked = true;
    }
}, { once: true });

const resizer = new ResizeObserver(() => { 
    if(window.parent) window.parent.postMessage({ iframeHeight: document.body.scrollHeight }, '*'); 
});
resizer.observe(document.body);

function initDomProfile() {
    const frame = document.getElementById('twitchFrame');
    if(frame && !frame.src) {
        const parents = ["qkarin.com", "www.qkarin.com", "entire-ecosystem.vercel.app", "html-components.wixusercontent.com", "filesusr.com", "editor.wix.com", "manage.wix.com", "localhost"];
        let parentString = "";
        parents.forEach(p => parentString += `&parent=${p}`);
        frame.src = `https://player.twitch.tv/?channel=${CONFIG.TWITCH_CHANNEL}${parentString}&muted=true&autoplay=true`;
    }
}
initDomProfile();

// --- 4. BRIDGE LISTENER ---

Bridge.listen((data) => {
    const ignoreList = ["CHAT_ECHO", "UPDATE_FULL_DATA", "UPDATE_DOM_STATUS", "instantUpdate", "instantReviewSuccess"];
    if (ignoreList.includes(data.type)) return; 
    window.postMessage(data, "*"); 
});

window.addEventListener("message", (event) => {
    try {
        const data = event.data;

        if (data.type === "CHAT_ECHO" && data.msgObj) renderChat([data.msgObj], true);

        if (data.type === 'UPDATE_RULES') {
            const rules = data.payload || {};
            for (let i = 1; i <= 8; i++) {
                const el = document.getElementById('r' + i);
                if (el && rules['rule' + i]) el.innerHTML = rules['rule' + i];
            }
        }

        if (data.type === "INIT_TASKS" || data.dailyTasks) setTaskDatabase(data.dailyTasks || data.tasks || []);
        if (data.type === "INIT_WISHLIST" || data.wishlist) {
            setWishlistItems(data.wishlist || []);
            window.WISHLIST_ITEMS = data.wishlist || []; 
            renderWishlist();
        }

        if (data.type === "UPDATE_DOM_STATUS") {
            const badge = document.getElementById('chatStatusBadge');
            const ring = document.getElementById('chatStatusRing');
            const domBadge = document.getElementById('domStatusBadge');
            if(badge) { badge.innerHTML = data.online ? "ONLINE" : data.text; badge.className = data.online ? "chat-status-text chat-online" : "chat-status-text"; }
            if(ring) ring.className = data.online ? "dom-status-ring ring-active" : "dom-status-ring ring-inactive";
            if(domBadge) { domBadge.innerHTML = data.online ? '<span class="status-dot"></span> ONLINE' : `<span class="status-dot"></span> ${data.text}`; domBadge.className = data.online ? "dom-status status-online" : "dom-status"; }
        }

        if (data.type === "UPDATE_Q_FEED") {
            const feedData = data.domVideos || data.posts || data.feed;
            if (feedData && Array.isArray(feedData)) {
                renderDomVideos(feedData);
                renderNews(feedData);
                const pc = document.getElementById('cntPosts');
                if (pc) pc.innerText = feedData.length;
            }
        }

        const payload = data.profile || data.galleryData || data.pendingState ? data : (data.type === "UPDATE_FULL_DATA" ? data : null);
        
        if (payload) {
            if (data.profile && !ignoreBackendUpdates) {
                setGameStats(data.profile);
                setUserProfile({
                    name: data.profile.name || "Slave",
                    hierarchy: data.profile.hierarchy || "HallBoy",
                    memberId: data.profile.memberId || "",
                    joined: data.profile.joined
                });
                
                if (data.profile.taskQueue) setTaskQueue(data.profile.taskQueue);
                
                if (data.profile.activeRevealMap) {
                    let map = [];
                    try { map = (typeof data.profile.activeRevealMap === 'string') ? JSON.parse(data.profile.activeRevealMap) : data.profile.activeRevealMap; } catch(e) { map = []; }
                    setActiveRevealMap(map);
                }
                
                if (data.profile.rewardVault) {
                    let vault = [];
                    try { vault = (typeof data.profile.rewardVault === 'string') ? JSON.parse(data.profile.rewardVault) : data.profile.rewardVault; } catch(e) { vault = []; }
                    setVaultItems(vault);
                }

                setLibraryProgressIndex(data.profile.libraryProgressIndex || 1);
                setCurrentLibraryMedia(data.profile.currentLibraryMedia || "");

                renderRewardGrid();
                if (data.profile.lastWorship) setLastWorshipTime(new Date(data.profile.lastWorship).getTime());
                setStats(migrateGameStatsToStats(data.profile, stats));
                if(data.profile.profilePicture) {
                    const picEl = document.getElementById('profilePic');
                    if(picEl) picEl.src = getOptimizedUrl(data.profile.profilePicture, 150);
                }
                updateStats(); 
            }

            if (data.type === "INSTANT_REVEAL_SYNC") {
                if (data.currentLibraryMedia) setCurrentLibraryMedia(data.currentLibraryMedia);
                renderRewardGrid(); 
                setTimeout(() => {
                    const winnerId = data.activeRevealMap[data.activeRevealMap.length - 1];
                    runTargetingAnimation(winnerId, () => {
                        setActiveRevealMap(data.activeRevealMap || []);
                        renderRewardGrid(); 
                    });
                }, 50); 
            }

            if (payload.galleryData) {
                const currentGalleryJson = JSON.stringify(payload.galleryData);
                if (currentGalleryJson !== lastGalleryJson) {
                    setLastGalleryJson(currentGalleryJson);
                    setGalleryData(payload.galleryData);
                    renderGallery();
                    console.log("Gallery data updated from backend.");
                    updateStats();
                }
            }

            if (payload.pendingState !== undefined) {
                if (!taskJustFinished && !ignoreBackendUpdates) {
                    setPendingTaskState(payload.pendingState);
                    if (pendingTaskState) {
                        setCurrentTask(pendingTaskState.task);
                        restorePendingUI();
                        
                        // FIXED: UPDATE UI BUT DO NOT FORCE OPEN DRAWER
                        window.updateTaskUIState(true);
                        
                    } else if (!resetUiTimer) {
                        window.updateTaskUIState(false);
                        const rt = document.getElementById('readyText');
                        if(rt) rt.innerText = "AWAITING ORDERS";
                    }
                }
            }
        }

        if (data.type === "UPDATE_CHAT" || data.chatHistory) renderChat(data.chatHistory || data.messages);

        if (data.type === "FRAGMENT_REVEALED") {
            const { fragmentNumber, isComplete } = data;
            import('../profile/kneeling/reward.js').then(({ runTargetingAnimation, renderRewardGrid }) => {
                runTargetingAnimation(fragmentNumber, () => {
                    renderRewardGrid();
                    if (isComplete) triggerSound('coinSound');
                });
            });
        }
    } catch(err) { console.error("Main error:", err); }
});

// --- EXPORTS & HELPERS ---
window.handleUploadStart = function(inputElement) {
    if (inputElement.files && inputElement.files.length > 0) {
        const btn = document.getElementById('btnUpload');
        if (btn) {
            btn.innerHTML = '...';
            btn.style.background = '#333';
            btn.style.color = '#ffd700'; 
            btn.style.cursor = 'wait';
        }
        if (typeof handleEvidenceUpload === 'function') handleEvidenceUpload(inputElement);
    }
};

window.switchTab = switchTab;
window.toggleStats = toggleStats;
window.openSessionUI = openSessionUI;
window.closeSessionUI = closeSessionUI;
window.updateSessionCost = updateSessionCost;
window.submitSessionRequest = submitSessionRequest;
window.sendChatMessage = sendChatMessage;
window.handleChatKey = handleChatKey;
window.loadMoreChat = loadMoreChat;
window.openChatPreview = openChatPreview;
window.closeChatPreview = closeChatPreview;
window.breakGlass = breakGlass;
window.openHistoryModal = openHistoryModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleHistoryView = toggleHistoryView;
window.loadMoreHistory = loadMoreHistory;
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
window.toggleTributeHunt = toggleTributeHunt;
window.selectTributeReason = selectTributeReason;
window.setTributeNote = setTributeNote;
window.filterByBudget = filterByBudget;
window.showTributeStep = showTributeStep;
window.toggleHuntNote = toggleHuntNote;
window.finalizeSacrifice = finalizeSacrifice;
window.resetTributeFlow = resetTributeFlow;
window.buyRealCoins = buyRealCoins;
window.getRandomTask = getRandomTask;
window.cancelPendingTask = cancelPendingTask;
window.handleEvidenceUpload = handleEvidenceUpload;
window.handleProfileUpload = handleProfileUpload;
window.handleAdminUpload = handleAdminUpload;
window.WISHLIST_ITEMS = WISHLIST_ITEMS;
window.gameStats = gameStats;

function updateStats() {
    const subName = document.getElementById('subName');
    const subHierarchy = document.getElementById('subHierarchy');
    const coinsEl = document.getElementById('coins');
    const pointsEl = document.getElementById('points');

    if (!subName || !userProfile || !gameStats) return; 

    subName.textContent = userProfile.name || "Slave";
    if (subHierarchy) subHierarchy.textContent = userProfile.hierarchy || "HallBoy";
    if (coinsEl) coinsEl.textContent = gameStats.coins ?? 0;
    if (pointsEl) pointsEl.textContent = gameStats.points ?? 0;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? 0; };
    if(gameStats) {
        setVal('statStreak', gameStats.taskdom_streak || gameStats.currentStreak);
        setVal('statTotal', gameStats.taskdom_total_tasks || gameStats.totalTasks);
        setVal('statCompleted', gameStats.taskdom_completed_tasks || gameStats.completedTasks);
        setVal('statSkipped', gameStats.skippedTasks || stats.skippedTasks);
        setVal('statTotalKneels', gameStats.kneelCount || gameStats.totalKneels);
    }

    const sinceEl = document.getElementById('slaveSinceDate');
    if (sinceEl) {
        if (userProfile && userProfile.joined) {
            try { sinceEl.textContent = new Date(userProfile.joined).toLocaleDateString(); } catch(e) { sinceEl.textContent = "--/--/--"; }
        } else {
            sinceEl.textContent = "--/--/--";
        }
    }

    if (typeof LEVELS !== 'undefined' && LEVELS.length > 0) {
        let nextLevel = LEVELS.find(l => l.min > gameStats.points) || LEVELS[LEVELS.length - 1];
        const nln = document.getElementById('nextLevelName');
        const pnd = document.getElementById('pointsNeeded');
        if(nln) nln.innerText = nextLevel.name;
        if(pnd) pnd.innerText = Math.max(0, nextLevel.min - gameStats.points) + " to go";
        
        const prevLevel = [...LEVELS].reverse().find(l => l.min <= gameStats.points) || {min: 0};
        const range = nextLevel.min - prevLevel.min;
        const progress = range > 0 ? ((gameStats.points - prevLevel.min) / range) * 100 : 100;
        const pb = document.getElementById('progressBar');
        if (pb) pb.style.width = Math.min(100, Math.max(0, progress)) + "%";
    }
    updateKneelingStatus(); 
}

// =========================================
// PART 1: MOBILE LOGIC (DASHBOARD & NAVIGATION)
// =========================================

// 1. STATS TOGGLE (The Expand Button)
window.toggleMobileStats = function() {
    const drawer = document.getElementById('mobStatsContent');
    const btn = document.querySelector('.mob-expand-btn');
    if(drawer) {
        drawer.classList.toggle('open');
        if(drawer.classList.contains('open')) btn.innerText = "▲ COLLAPSE DATA ▲";
        else btn.innerText = "▼ PERFORMANCE DATA ▼";
    }
};

// 2. VIEW SWITCHER (Home vs Chat)
window.toggleMobileView = function(viewName) {
    const home = document.getElementById('viewMobileHome');
    const chat = document.getElementById('viewServingTop');
    const chatContainer = document.querySelector('.chat-container');
    
    // RESET: Hide all mobile views
    if(home) home.style.display = 'none';
    if(chat) chat.style.display = 'none'; 
    if(chatContainer) chatContainer.style.display = 'none';

    // SHOW: Target View
    if (viewName === 'chat') {
        if(chatContainer) {
            chatContainer.style.display = 'flex';
            // Scroll Fix
            const chatBox = document.getElementById('chatBox');
            if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
        } else if (chat) {
            chat.style.display = 'flex';
        }
    } 
    else if (viewName === 'home') {
        if(home) home.style.display = 'flex';
        // Force a data refresh when we go home
        if(window.syncMobileDashboard) window.syncMobileDashboard();
    }
    
    // Close sidebar if open
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.remove('mobile-open');
};

// 3. KNEEL BUTTON
window.triggerKneel = function() {
    const sidebar = document.querySelector('.layout-left');
    const realBtn = document.querySelector('.kneel-bar-graphic');
    
    // We still open the sidebar for kneeling because it has the physics bar
    if (sidebar) sidebar.classList.add('mobile-open'); 

    if (realBtn) {
        realBtn.style.boxShadow = "0 0 20px var(--neon-red)";
        setTimeout(() => realBtn.style.boxShadow = "", 1000);
    }
};

// 4. DATA SYNC (Connects Backend to Mobile Dashboard)
window.syncMobileDashboard = function() {
    if (!window.gameStats || !window.userProfile) return;

    // Header Data
    const elName = document.getElementById('mobName');
    const elHier = document.getElementById('mobHierarchy');
    const elPoints = document.getElementById('mobPoints');
    const elCoins = document.getElementById('mobCoins');
    const elPic = document.getElementById('mobProfilePic');

    if (elName) elName.innerText = window.userProfile.name || "SLAVE";
    if (elHier) elHier.innerText = window.userProfile.hierarchy || "INITIATE";
    if (elPoints) elPoints.innerText = window.gameStats.points || 0;
    if (elCoins) elCoins.innerText = window.gameStats.coins || 0;
    
    // Profile Pic
    if (elPic && window.userProfile.profilePicture) {
        elPic.src = getOptimizedUrl(window.userProfile.profilePicture, 150); 
    }

    // Stats Drawer
    if (document.getElementById('mobStreak')) document.getElementById('mobStreak').innerText = window.gameStats.taskdom_streak || 0;
    if (document.getElementById('mobTotal')) document.getElementById('mobTotal').innerText = window.gameStats.taskdom_total_tasks || 0;
    if (document.getElementById('mobCompleted')) document.getElementById('mobCompleted').innerText = window.gameStats.taskdom_completed_tasks || 0;
    if (document.getElementById('mobKneels')) document.getElementById('mobKneels').innerText = window.gameStats.kneelCount || 0;
    
    // Progress Bar
    if (document.getElementById('mobNextLevel')) {
        document.getElementById('mobNextLevel').innerText = "NEXT RANK"; 
    }
};

// 5. UPDATE FOOTER CLICK (Profile -> Home)
// (This is handled in Part 2 below)


// =========================================
// PART 2: FINAL APP MODE (NATIVE FLOW)
// =========================================

(function() {
    // Only run on Mobile
    if (window.innerWidth > 768) return;

    // 1. LOCK THE FRAME, BUT LET THE CONTENT BREATHE
    function lockVisuals() {
        const height = window.innerHeight;
        
        // A. BODY: FROZEN SOLID
        Object.assign(document.body.style, {
            height: height + 'px',
            width: '100%',
            position: 'fixed',
            overflow: 'hidden',
            inset: '0',
            overscrollBehavior: 'none',
            touchAction: 'none'
        });

        // B. APP CONTAINER
        const app = document.querySelector('.app-container');
        if (app) Object.assign(app.style, { height: '100%', overflow: 'hidden' });

        // C. CONTENT STAGE: FREE TO MOVE
        const stage = document.querySelector('.content-stage');
        if (stage) {
            Object.assign(stage.style, {
                height: '100%',
                overflowY: 'auto',              
                webkitOverflowScrolling: 'touch', 
                paddingBottom: '100px',
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y'
            });
        }
        
        // D. MOBILE DASHBOARD: FREE TO MOVE
        const home = document.getElementById('viewMobileHome');
        if (home) {
             Object.assign(home.style, {
                height: '100%',
                overflowY: 'auto',
                webkitOverflowScrolling: 'touch',
                paddingBottom: '100px',
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y'
            });
        }
    }

    // 2. BUILD FOOTER
    function buildAppFooter() {
        if (document.getElementById('app-mode-footer')) return;
        
        const footer = document.createElement('div');
        footer.id = 'app-mode-footer';
        
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'fixed', bottom: '0', left: '0', width: '100%', height: '80px',
            background: 'linear-gradient(to top, #000 40%, rgba(0,0,0,0.95))',
            padding: '0 30px', paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: '2147483647', borderTop: '1px solid rgba(197, 160, 89, 0.3)',
            backdropFilter: 'blur(10px)', pointerEvents: 'auto', 
            touchAction: 'none'
        });

        footer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        footer.innerHTML = `
            <button onclick="window.toggleMobileView('home')" style="background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; gap:4px; font-family:'Cinzel',serif; font-size:0.65rem;">
                <span style="font-size:1.4rem; color:#888;">◈</span>
                <span>PROFILE</span>
            </button>
            <div style="position:relative; top:-20px;">
                <button onclick="window.triggerKneel()" style="width:70px; height:70px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #c5a059, #5a4a22); border:2px solid #fff; box-shadow:0 0 20px rgba(197,160,89,0.6); color:#000; font-family:'Cinzel',serif; font-weight:700; font-size:0.7rem; cursor:pointer;">
                    KNEEL
                </button>
            </div>
            <button onclick="window.toggleMobileView('chat')" style="background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; gap:4px; font-family:'Cinzel',serif; font-size:0.65rem;">
                <span style="font-size:1.4rem; color:#888;">❖</span>
                <span>LOGS</span>
            </button>
        `;
        document.body.appendChild(footer);
    }

    // 3. RUN
    window.addEventListener('load', () => { 
        lockVisuals(); 
        buildAppFooter();
        // FORCE HOME ON LOAD
        if(window.toggleMobileView) window.toggleMobileView('home'); 
    });
    window.addEventListener('resize', lockVisuals);
    lockVisuals(); buildAppFooter();
})();

window.parent.postMessage({ type: "UI_READY" }, "*");
