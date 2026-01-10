// Task management functions - WITH 300 COIN COLLATERAL & AUTO-PENALTY
import { 
    currentTask, pendingTaskState, taskDatabase, taskQueue, gameStats, 
    resetUiTimer, cooldownInterval, taskJustFinished, ignoreBackendUpdates 
} from './state.js';
import { 
    setCurrentTask, setPendingTaskState, setGameStats, 
    setIgnoreBackendUpdates, setTaskJustFinished, setResetUiTimer, setCooldownInterval
} from './state.js';
import { triggerSound } from './utils.js';

export function getRandomTask() {
    // --- 1. COLLATERAL CHECK (NEW) ---
    // Slave must have 300 coins to even see a task
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        
        // Show shame in the chat
        const chatContent = document.getElementById('chatContent');
        if (chatContent) {
            chatContent.innerHTML += `
                <div class="msg-row system-row">
                    <div class="msg-system sys-red">
                        <svg class="sys-icon"><use href="#icon-close"></use></svg>
                        ACCESS DENIED: 300 🪙 REQUIRED TO RECEIVE ORDERS
                    </div>
                </div>`;
            // Scroll to bottom
            const b = document.getElementById('chatBox');
            if (b) b.scrollTop = b.scrollHeight;
        }
        
        alert("You are too poor to serve. Earn 300 coins first.");
        return; // STOP - Do not give a task
    }

    // --- 2. PROCEED WITH TASK GENERATION ---
    setIgnoreBackendUpdates(true);
    
    if (resetUiTimer) { 
        clearTimeout(resetUiTimer); 
        setResetUiTimer(null); 
    }
    
    // --- FIXED: REMOVED "Waiting for orders..." ---
    let taskText = "AWAITING DIRECTIVE..."; 
    
    if (taskQueue && taskQueue.length > 0) {
        taskText = taskQueue[0];
    } else if (taskDatabase && taskDatabase.length > 0) {
        taskText = taskDatabase[Math.floor(Math.random() * taskDatabase.length)];
    }
    
    const newTask = { text: taskText, category: 'general', timestamp: Date.now() };
    setCurrentTask(newTask);
    
    const endTimeVal = Date.now() + 86400000; // 24 Hours
    const newPendingState = { task: newTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    restorePendingUI();
    
    // Communication with Wix
    window.parent.postMessage({ 
        type: "savePendingState", 
        pendingState: newPendingState, 
        consumeQueue: true 
    }, "*");
    
    setTimeout(() => { 
        setIgnoreBackendUpdates(false); 
    }, 5000);
}

export function restorePendingUI() {
    if (resetUiTimer) { 
        clearTimeout(resetUiTimer); 
        setResetUiTimer(null); 
    }
    
    // Clear old interval if it exists
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    document.getElementById('mainButtonsArea').classList.add('hidden');
    document.getElementById('activeBadge').classList.add('show');
    
    if (currentTask) {
        // Render the task text nicely
        document.getElementById('taskContent').innerHTML = `<div style="font-family:'Cinzel', serif; font-size:1.1rem; color:#e0e0e0; padding:10px; line-height:1.4;">${currentTask.text}</div>`;
    }
    
    document.getElementById('cooldownSection').classList.remove('hidden');
    
    const targetTime = parseInt(pendingTaskState?.endTime);
    if (!targetTime) return;

    const newInterval = setInterval(() => {
        const diff = targetTime - Date.now();
        
        if (diff <= 0) {
            // --- 3. AUTO-PENALTY ON EXPIRY (NEW) ---
            clearInterval(newInterval);
            setCooldownInterval(null);
            
            const td = document.getElementById('timerDisplay');
            if(td) td.textContent = "00:00:00";

            applyPenaltyFail("TIMEOUT"); // New failure logic
            return;
        }

        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        
        const td = document.getElementById('timerDisplay');
        if(td) td.textContent = `${h}:${m}:${s}`;
    }, 1000);
    
    setCooldownInterval(newInterval);
}

// NEW HELPER FUNCTION: Handles the actual coin theft and failure
function applyPenaltyFail(reason) {
    // 1. Visual/Sound Feedback
    triggerSound('sfx-deny');

    // 2. Subtract 300 coins locally
    const newBalance = Math.max(0, gameStats.coins - 300);
    setGameStats({ coins: newBalance });
    
    // Update the UI immediately
    const coinsEl = document.getElementById('coins');
    if (coinsEl) coinsEl.textContent = newBalance;

    // 3. Tell Wix to take the real money
    window.parent.postMessage({ 
        type: "taskSkipped", 
        taskTitle: currentTask ? currentTask.text : "Unknown Task",
        reason: reason
    }, "*");

    // 4. Reset UI to show they are pathetic
    finishTask(false);
}

export function finishTask(success) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    setTaskJustFinished(true);
    setPendingTaskState(null);
    setCooldownInterval(null);
    
    const celebration = document.getElementById('celebrationOverlay');
    if (celebration && success) {
        celebration.classList.add('active');
        setTimeout(() => celebration.classList.remove('active'), 2500);
    }
    
    resetTaskDisplay(success);
    
    setTimeout(() => { 
        setTaskJustFinished(false); 
        setIgnoreBackendUpdates(false); 
    }, 5000);
}

export function cancelPendingTask() {
    if (!currentTask) return;
    
    // Check coins for manual skip
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        alert("You cannot afford the 300 coin skip fee.");
        return;
    }
    
    // Use the penalty function
    applyPenaltyFail("MANUAL_SKIP");
}

export function resetTaskDisplay(success) {
    document.getElementById('cooldownSection').classList.add('hidden');
    document.getElementById('activeBadge').classList.remove('show');
    document.getElementById('mainButtonsArea').classList.remove('hidden');
    
    // Luxury Terminal Colors (Gold/Red) instead of Neon
    const color = success ? '#c5a059' : '#8b0000';
    const text = success ? 'DIRECTIVE COMPLETE' : 'FAILURE RECORDED (-300 🪙)';
    
    const tc = document.getElementById('taskContent');
    // Using Cinzel font for the status message
    if(tc) tc.innerHTML = `<h2 style="font-family:'Cinzel', serif; font-weight:700; font-size:1.2rem; color:${color}; margin-top:20px;">${text}</h2>`;
    
    setCurrentTask(null);
    
    if (resetUiTimer) clearTimeout(resetUiTimer);
    
    // The Reset Timer
    const timer = setTimeout(() => {
        if(tc) {
            // RESTORES THE LUXURY "VACANT ASSET" UI
            tc.innerHTML = `
                <h2 id="readyText">VACANT ASSET</h2>
                <p class="inter">
                    Current status: Unproductive. <br>
                    Standby for mandatory labor assignment.
                </p>
            `;
        }
        setResetUiTimer(null);
    }, 4000);
    
    setResetUiTimer(timer);
}
