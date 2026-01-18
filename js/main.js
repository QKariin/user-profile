// main.js - CENTRAL NERVOUS SYSTEM (DESKTOP + MOBILE)

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

// --- 1. DESKTOP UI LOGIC ---

window.toggleTaskDetails = function(forceOpen = null) {
    if (window.event) window.event.stopPropagation();
    const panel = document.getElementById('taskDetailPanel');
    const link = document.querySelector('.see-task-link'); 
    const chatBox = document.getElementById('chatBox'); 
    if (!panel) return;
    const isOpen = panel.classList.contains('open');
    let shouldOpen = (forceOpen === true) ? true : (forceOpen === false ? false : !isOpen);

    if (shouldOpen) {
        panel.classList.add('open');
        if(chatBox) chatBox.classList.add('focused-task');
        if(link) { link.innerHTML = "▲ HIDE DIRECTIVE ▲"; link.style.opacity = "1"; }
    } else {
        panel.classList.remove('open');
        if(chatBox) chatBox.classList.remove('focused-task');
        if(link) { link.innerHTML = "▼ SEE DIRECTIVE ▼"; link.style.opacity = "1"; }
    }
};

window.updateTaskUIState = function(isActive) {
    const statusText = document.getElementById('mainStatusText');
    const idleMsg = document.getElementById('idleMessage');
    const timerRow = document.getElementById('activeTimerRow');
    const reqBtn = document.getElementById('mainButtonsArea');
    const uploadArea = document.getElementById('uploadBtnContainer');

    if (isActive) {
        if (statusText) { statusText.innerText = "WORKING"; statusText.className = "status-text-lg status-working"; }
        if (idleMsg) idleMsg.classList.add('hidden');
        if (timerRow) timerRow.classList.remove('hidden');
        if (reqBtn) reqBtn.classList.add('hidden');
        if (uploadArea) uploadArea.classList.remove('hidden');
    } else {
        if (statusText) { statusText.innerText = "UNPRODUCTIVE"; statusText.className = "status-text-lg status-unproductive"; }
        if (idleMsg) idleMsg.classList.remove('hidden');
        if (timerRow) timerRow.classList.add('hidden');
        if (reqBtn) reqBtn.classList.remove('hidden');
        if (uploadArea) uploadArea.classList.add('hidden');
        window.toggleTaskDetails(false);
    }
};

document.addEventListener('click', function(event) {
    const card = document.getElementById('taskCard');
    const panel = document.getElementById('taskDetailPanel');
    if (event.target.closest('.see-task-link')) return;
    if (panel && panel.classList.contains('open') && card && !card.contains(event.target)) {
        window.toggleTaskDetails(false);
    }
});

// --- 2. INITIALIZATION ---

document.addEventListener('click', () => {
    if (!window.audioUnlocked) {
        ['msgSound', 'coinSound', 'skipSound', 'sfx-buy', 'sfx-deny'].forEach(id => {
            const sound = document.getElementById(id);
            if (sound) {
                const originalVolume = sound.volume;
                sound.volume = 0;
                sound.play().then(() => { sound.pause(); sound.currentTime = 0; sound.volume = originalVolume; }).catch(e => console.log("Audio Engine Ready"));
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

// --- 3. DATA BRIDGE ---

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
                    updateStats();
                }
            }

            if (payload.pendingState !== undefined) {
                if (!taskJustFinished && !ignoreBackendUpdates) {
                    setPendingTaskState(payload.pendingState);
                    if (pendingTaskState) {
                        setCurrentTask(pendingTaskState.task);
                        restorePendingUI();
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

// --- 4. EXPORTS ---
window.handleUploadStart = function(inputElement) {
    if (inputElement.files && inputElement.files.length > 0) {
        const btn = document.getElementById('btnUpload');
        if (btn) { btn.innerHTML = '...'; btn.style.background = '#333'; btn.style.color = '#ffd700'; btn.style.cursor = 'wait'; }
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

// --- 5. STATS & DATA SYNC (DUAL UPDATE) ---
function updateStats() {
    const subName = document.getElementById('subName');
    const subHierarchy = document.getElementById('subHierarchy');
    const coinsEl = document.getElementById('coins');
    const pointsEl = document.getElementById('points');

    if (!subName || !userProfile || !gameStats) return; 

    // Desktop
    subName.textContent = userProfile.name || "Slave";
    if (subHierarchy) subHierarchy.textContent = userProfile.hierarchy || "HallBoy";
    if (coinsEl) coinsEl.textContent = gameStats.coins ?? 0;
    if (pointsEl) pointsEl.textContent = gameStats.points ?? 0;

    // Mobile Direct Sync (No external function needed)
    const mobName = document.getElementById('mob_slaveName');
    const mobRank = document.getElementById('mob_rankStamp');
    const mobPic = document.getElementById('mob_profilePic');

    if (mobName) mobName.innerText = userProfile.name || "SLAVE";
    if (mobRank) mobRank.innerText = userProfile.hierarchy || "INITIATE";
    
    if (mobPic && userProfile.profilePicture) {
        let rawUrl = userProfile.profilePicture;
        if (rawUrl.startsWith("wix:image")) {
            const uri = rawUrl.split('/')[3].split('#')[0];
            mobPic.src = `https://static.wixstatic.com/media/${uri}`;
        } else {
            mobPic.src = rawUrl;
        }
    }

    // Grid Fill
    const grid = document.getElementById('mob_streakGrid');
    if(grid) {
        grid.innerHTML = '';
        const progress = (gameStats.kneelCount || 0) % 24;
        for(let i=0; i<24; i++) {
            const sq = document.createElement('div');
            sq.className = 'streak-sq' + (i < progress ? ' active' : '');
            grid.appendChild(sq);
        }
    }

    // Levels
    if (typeof LEVELS !== 'undefined' && LEVELS.length > 0) {
        let nextLevel = LEVELS.find(l => l.min > gameStats.points) || LEVELS[LEVELS.length - 1];
        const nln = document.getElementById('nextLevelName');
        const pnd = document.getElementById('pointsNeeded');
        if(nln) nln.innerText = nextLevel.name;
        if(pnd) pnd.innerText = Math.max(0, nextLevel.min - gameStats.points) + " to go";
        const pb = document.getElementById('progressBar');
        const progress = ((gameStats.points - 0) / (nextLevel.min - 0)) * 100;
        if (pb) pb.style.width = Math.min(100, Math.max(0, progress)) + "%";
    }
    updateKneelingStatus(); 
}

// =========================================
// PART 6: MOBILE LOGIC (BRAIN & NAVIGATION)
// =========================================

// MOBILE NAV SWITCHER
window.toggleMobileView = function(viewName) {
    const home = document.getElementById('viewMobileHome');
    const chatCard = document.getElementById('chatCard');
    const mobileApp = document.getElementById('MOBILE_APP');
    const history = document.getElementById('viewMobileRecord');
    const news = document.getElementById('viewNews');
    const protocol = document.getElementById('viewProtocol');
    
    // Hide All
    const views = [home, history, news, protocol];
    views.forEach(el => { if(el) el.style.display = 'none'; });

    // Force Chat to Desktop to hide it
    if (chatCard && mobileApp && chatCard.parentElement === mobileApp) {
        // We move it out to hide it
        const desktopParent = document.getElementById('viewServingTop');
        if(desktopParent) desktopParent.appendChild(chatCard);
    }

    // Show Target
    if (viewName === 'home') {
        if(home) {
            home.style.display = 'flex';
            updateStats(); // Refresh data
        }
    }
    else if (viewName === 'chat') {
        // Teleport Chat to Mobile
        if(chatCard && mobileApp) {
            mobileApp.appendChild(chatCard);
            chatCard.style.display = 'flex';
            const chatBox = document.getElementById('chatBox');
            if (chatBox) setTimeout(() => { chatBox.scrollTop = chatBox.scrollHeight; }, 100);
        }
    }
    else if (viewName === 'record') {
        if(history) {
            history.style.display = 'flex';
            if(window.renderGallery) window.renderGallery();
        }
    }
    else if (viewName === 'queen') {
        if(news) news.style.display = 'block';
    }
    else if (viewName === 'global') {
        if(protocol) protocol.style.display = 'block';
    }
    
    // Close sidebar
    const sidebar = document.querySelector('.layout-left');
    if (sidebar) sidebar.classList.remove('mobile-open');
    document.querySelectorAll('.mf-btn').forEach(btn => btn.classList.remove('active'));
};

// KNEEL BUTTON
window.triggerKneel = function() {
    const sidebar = document.querySelector('.layout-left');
    const realBtn = document.querySelector('.kneel-bar-graphic');
    if (sidebar) sidebar.classList.add('mobile-open'); 
    if (realBtn) {
        realBtn.style.boxShadow = "0 0 20px var(--neon-red)";
        setTimeout(() => realBtn.style.boxShadow = "", 1000);
    }
};

// =========================================
// PART 7: APP MODE ENGINE (LAYOUT & FOOTER)
// =========================================

(function() {
    if (window.innerWidth > 768) return;

    function lockVisuals() {
        const height = window.innerHeight;
        
        Object.assign(document.body.style, {
            height: height + 'px', width: '100%', position: 'fixed', overflow: 'hidden', inset: '0',
            overscrollBehavior: 'none', touchAction: 'none'
        });

        const app = document.querySelector('.app-container');
        if (app) Object.assign(app.style, { height: '100%', overflow: 'hidden' });

        const scrollables = document.querySelectorAll('.content-stage, .chat-body-frame, #viewMobileHome, #viewMobileRecord, #viewNews');
        scrollables.forEach(el => {
            Object.assign(el.style, {
                height: '100%', overflowY: 'auto', webkitOverflowScrolling: 'touch',
                paddingBottom: '100px', overscrollBehaviorY: 'contain', touchAction: 'pan-y'
            });
        });
    }

    function buildAppFooter() {
        if (document.getElementById('app-mode-footer')) return;
        
        const footer = document.createElement('div');
        footer.id = 'app-mode-footer';
        
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'space-around', alignItems: 'center',
            position: 'fixed', bottom: '0', left: '0', width: '100%', height: '80px',
            background: 'linear-gradient(to top, #000 40%, rgba(0,0,0,0.95))',
            paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: '2147483647', borderTop: '1px solid rgba(197, 160, 89, 0.3)',
            backdropFilter: 'blur(10px)', pointerEvents: 'auto', touchAction: 'none'
        });

        footer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        const btnStyle = "background:none; border:none; color:#666; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer;";
        const chatStyle = "background:none; border:none; color:#ff003c; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-family:'Cinzel',serif; font-size:0.55rem; width:20%; height:100%; cursor:pointer; text-shadow: 0 0 10px rgba(255,0,60,0.4);";

        footer.innerHTML = `
            <button onclick="window.toggleMobileView('home')" style="${btnStyle}">
                <span style="font-size:1.4rem; color:#888;">◈</span><span>PROFILE</span>
            </button>
            <button onclick="window.toggleMobileView('record')" style="${btnStyle}">
                <span style="font-size:1.4rem; color:#888;">▦</span><span>RECORD</span>
            </button>
            <button onclick="window.toggleMobileView('chat')" style="${chatStyle}">
                <span style="font-size:1.6rem; color:#ff003c;">❖</span><span>LOGS</span>
            </button>
            <button onclick="window.toggleMobileView('queen')" style="${btnStyle}">
                <span style="font-size:1.4rem; color:#888;">♛</span><span>QUEEN</span>
            </button>
            <button onclick="window.toggleMobileView('global')" style="${btnStyle}">
                <span style="font-size:1.4rem; color:#888;">🌐</span><span>GLOBAL</span>
            </button>
        `;
        document.body.appendChild(footer);
    }

    // RUN & FOCUS MODE
    window.addEventListener('load', () => { 
        lockVisuals(); 
        buildAppFooter();
        
        // FOCUS MODE
        const input = document.getElementById('chatMsgInput');
        if (input) {
            input.addEventListener('focus', () => {
                const footer = document.getElementById('app-mode-footer');
                const chatBar = document.querySelector('.chat-footer');
                if (footer) { footer.style.transition = "bottom 0.3s ease"; footer.style.bottom = "-200px"; }
                if (chatBar) { chatBar.style.transition = "bottom 0.3s ease"; chatBar.style.bottom = "0px"; }
            });
            input.addEventListener('blur', () => {
                const footer = document.getElementById('app-mode-footer');
                const chatBar = document.querySelector('.chat-footer');
                setTimeout(() => {
                    if (footer) footer.style.bottom = "0";
                    if (chatBar) chatBar.style.bottom = "80px";
                }, 100);
            });
        }

        if(window.toggleMobileView) window.toggleMobileView('home'); 
    });
    
    window.addEventListener('resize', lockVisuals);
    lockVisuals(); 
    buildAppFooter();
})();

// TIMER SYNC
setInterval(() => {
    const desktopH = document.getElementById('timerH');
    const desktopM = document.getElementById('timerM');
    const desktopS = document.getElementById('timerS');
    const mobileH = document.getElementById('m_timerH');
    const mobileM = document.getElementById('m_timerM');
    const mobileS = document.getElementById('m_timerS');
    
    if (desktopH && mobileH) mobileH.innerText = desktopH.innerText;
    if (desktopM && mobileM) mobileM.innerText = desktopM.innerText;
    if (desktopS && mobileS) mobileS.innerText = desktopS.innerText;
    
    const activeRow = document.getElementById('activeTimerRow');
    const mobTimer = document.getElementById('mob_activeTimer');
    const mobRequestBtn = document.getElementById('mob_btnRequest');
    
    if (activeRow && mobTimer && mobRequestBtn) {
        const isWorking = !activeRow.classList.contains('hidden');
        if (isWorking) {
            mobTimer.classList.remove('hidden');
            mobRequestBtn.classList.add('hidden');
            const light = document.getElementById('mob_statusLight');
            const text = document.getElementById('mob_statusText');
            if(light) light.className = 'status-light green';
            if(text) text.innerText = "WORKING";
        } else {
            mobTimer.classList.add('hidden');
            mobRequestBtn.classList.remove('hidden');
            const light = document.getElementById('mob_statusLight');
            const text = document.getElementById('mob_statusText');
            if(light) light.className = 'status-light red';
            if(text) text.innerText = "UNPRODUCTIVE";
        }
    }
}, 500);

// RE-INJECT TRIBUTE FUNCTIONS
window.toggleTributeHunt = function() { 
    const overlay = document.getElementById('tributeHuntOverlay'); 
    if (overlay.classList.contains('hidden')) { 
        if(document.getElementById('huntNote')) document.getElementById('huntNote').value = ""; 
        overlay.classList.remove('hidden'); 
        const step1 = document.getElementById('tributeStep1');
        if(step1) {
            document.querySelectorAll('.tribute-step').forEach(el => el.classList.add('hidden'));
            step1.classList.remove('hidden');
        }
    } else { 
        overlay.classList.add('hidden'); 
    } 
};

window.parent.postMessage({ type: "UI_READY" }, "*");
