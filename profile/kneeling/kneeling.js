// kneeling.js - DUAL SYSTEM (SELF-REGISTERING)
import { 
    isLocked, lastWorshipTime, COOLDOWN_MINUTES, gameStats, ignoreBackendUpdates, userProfile
} from '../../js/state.js'; // Ensure path is correct relative to this file
import { 
    setIsLocked, setLastWorshipTime, setIgnoreBackendUpdates 
} from '../../js/state.js';
import { triggerSound } from '../../js/utils.js';

let holdTimer = null;
const REQUIRED_HOLD_TIME = 2000;

// --- 1. HOLD START (Triggers Animation) ---
export function handleHoldStart(e) {
    // If locked, do nothing
    if (isLocked) return;
    
    // Stop mobile text selection/scrolling while holding
    if (e && e.type === 'touchstart' && e.cancelable) {
        e.preventDefault();
    }

    // TARGET DESKTOP
    const fill = document.getElementById('fill');
    const txtMain = document.getElementById('txt-main');
    
    // TARGET MOBILE
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label'); // Targeting class inside the button
    const mobBar = document.querySelector('.mob-kneel-bar');

    // ANIMATE DESKTOP
    if (fill) {
        fill.style.transition = "width 2s linear"; 
        fill.style.width = "100%";
    }
    if (txtMain) txtMain.innerText = "KNEELING...";

    // ANIMATE MOBILE
    if (mobFill) {
        mobFill.style.transition = "width 2s linear";
        mobFill.style.width = "100%";
    }
    if (mobText) mobText.innerText = "SUBMITTING...";
    if (mobBar) mobBar.style.borderColor = "#c5a059"; // Glow effect

    holdTimer = setTimeout(() => {
        completeKneelAction();
    }, REQUIRED_HOLD_TIME);
}

// --- 2. HOLD END (Reset if failed) ---
export function handleHoldEnd() {
    // If locked, do not reset UI (keep it showing "LOCKED")
    if (isLocked) {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
        return; 
    }

    if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        
        // RESET DESKTOP
        const fill = document.getElementById('fill');
        const txtMain = document.getElementById('txt-main');
        if (fill) {
            fill.style.transition = "width 0.3s ease"; 
            fill.style.width = "0%";
        }
        if (txtMain) txtMain.innerText = "HOLD TO KNEEL";

        // RESET MOBILE
        const mobFill = document.getElementById('mob_kneelFill');
        const mobText = document.querySelector('.kneel-label');
        const mobBar = document.querySelector('.mob-kneel-bar');

        if (mobFill) {
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
        }
        if (mobText) mobText.innerText = "HOLD";
        if (mobBar) mobBar.style.borderColor = "#c5a059"; 
    }
}

// --- 3. COMPLETION LOGIC ---
function completeKneelAction() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null; 

    const now = Date.now();
    setLastWorshipTime(now); 
    setIsLocked(true); 
    setIgnoreBackendUpdates(true);

    // Tell Wix
    window.parent.postMessage({ type: "FINISH_KNEELING" }, "*");

    // Update UI instantly
    updateKneelingStatus();

    // Show Reward Overlay
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) {
        rewardMenu.classList.remove('hidden');
        rewardMenu.style.display = 'flex';
    }

    triggerSound('msgSound');
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 15000);
}

// --- 4. STATUS UPDATE (The Twin Sync) ---
export function updateKneelingStatus() {
    const now = Date.now();
    
    // Day Code
    const today = new Date();
    const m = today.getMonth() + 1; 
    const day = today.getDate();
    const dayCode = ((110 - m) * 100 + (82 - day)).toString().padStart(4, '0');
    const idEl = document.getElementById('dailyRandomId');
    if (idEl) idEl.innerText = "#" + dayCode;

    // DESKTOP ELEMENTS
    const btn = document.getElementById('btn');
    const txtMain = document.getElementById('txt-main');
    const fill = document.getElementById('fill');
    
    // MOBILE ELEMENTS
    const mobFill = document.getElementById('mob_kneelFill');
    const mobText = document.querySelector('.kneel-label'); // Correct Selector
    const mobBar = document.querySelector('.mob-kneel-bar');

    const diffMs = now - lastWorshipTime;
    const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

    // A. LOCKED STATE
    if (lastWorshipTime > 0 && diffMs < cooldownMs) {
        setIsLocked(true);
        const minLeft = Math.ceil((cooldownMs - diffMs) / 60000);
        
        // Update Desktop
        if (txtMain && fill) {
            txtMain.innerText = `LOCKED: ${minLeft}m`;
            const progress = 100 - ((diffMs / cooldownMs) * 100);
            fill.style.transition = "none";
            fill.style.width = Math.max(0, progress) + "%";
            if(btn) btn.style.cursor = "not-allowed";
        }

        // Update Mobile
        if (mobText && mobFill) {
            mobText.innerText = `${minLeft}m`; // Short text for mobile icon
            const progress = 100 - ((diffMs / cooldownMs) * 100);
            mobFill.style.transition = "none";
            mobFill.style.width = Math.max(0, progress) + "%";
            // Make mobile bar look locked
            if(mobBar) {
                mobBar.style.borderColor = "#ff003c"; // Red
                mobBar.style.opacity = "0.7";
            }
        }
    } 
    // B. UNLOCKED STATE
    else if (!holdTimer) { 
        setIsLocked(false);
        
        // Reset Desktop
        if (txtMain && fill) {
            txtMain.innerText = "HOLD TO KNEEL";
            fill.style.transition = "width 0.3s ease";
            fill.style.width = "0%";
            if(btn) btn.style.cursor = "pointer";
        }

        // Reset Mobile
        if (mobText && mobFill) {
            mobText.innerText = "HOLD";
            mobFill.style.transition = "width 0.3s ease";
            mobFill.style.width = "0%";
            if(mobBar) {
                mobBar.style.borderColor = "#c5a059"; // Gold
                mobBar.style.opacity = "1";
            }
        }
    }
}

// --- 5. REWARDS ---
export function claimKneelReward(choice) {
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');

    triggerSound('coinSound');
    triggerCoinShower();

    window.parent.postMessage({ 
        type: "CLAIM_KNEEL_REWARD", 
        rewardType: choice,
        rewardValue: choice === 'coins' ? 10 : 50
    }, "*");

    // Direct Bridge Import if needed, but postMessage usually handles it
    if(window.Bridge) {
         window.Bridge.send("SLAVE_REWARD_CLAIMED", {
            choice: choice,
            value: choice === 'coins' ? 10 : 50,
            timestamp: Date.now()
        });
    }
}

// --- COIN SHOWER ---
function triggerCoinShower() {
    for (let i = 0; i < 40; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-particle';
        coin.innerHTML = `<svg style="width:100%; height:100%; fill:gold;"><use href="#icon-coin"></use></svg>`;
        coin.style.setProperty('--tx', `${Math.random() * 200 - 100}vw`);
        coin.style.setProperty('--ty', `${-(Math.random() * 80 + 20)}vh`);
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 2000);
    }
}

// --- CRITICAL FIX: SELF-REGISTER TO WINDOW ---
// This ensures HTML onclick="..." works even if main.js is slow
window.handleHoldStart = handleHoldStart;
window.handleHoldEnd = handleHoldEnd;
window.claimKneelReward = claimKneelReward;
window.updateKneelingStatus = updateKneelingStatus;
