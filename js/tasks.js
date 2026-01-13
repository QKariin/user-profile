// tasks.js - CHAT ONLY (No Overlay, No Task Text in Log)

import { 
    currentTask, pendingTaskState, taskDatabase, taskQueue, gameStats, 
    resetUiTimer, cooldownInterval, taskJustFinished, ignoreBackendUpdates,
    setCurrentTask, setPendingTaskState, setGameStats, 
    setIgnoreBackendUpdates, setTaskJustFinished, setResetUiTimer, setCooldownInterval
} from './state.js';
import { triggerSound, cleanHTML } from './utils.js';

// Default insults
const DEFAULT_TRASH = [
    "Pathetic. Pay the price.",
    "Disappointing as always.",
    "Your failure feeds me.",
    "Try harder next time, worm.",
    "Obedience is not optional."
];

export function getRandomTask() {
    // 1. Collateral Check
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        injectChatMessage(false, "ACCESS DENIED: 300 🪙 REQUIRED");
        alert("You are too poor to serve. Earn 300 coins first.");
        return;
    }

    // 2. Setup Task
    setIgnoreBackendUpdates(true);
    if (resetUiTimer) { clearTimeout(resetUiTimer); setResetUiTimer(null); }
    
    let taskText = "AWAITING DIRECTIVE..."; 
    if (taskQueue && taskQueue.length > 0) taskText = taskQueue[0];
    else if (taskDatabase && taskDatabase.length > 0) taskText = taskDatabase[Math.floor(Math.random() * taskDatabase.length)];
    
    const newTask = { text: taskText, category: 'general', timestamp: Date.now() };
    setCurrentTask(newTask);
    
    const endTimeVal = Date.now() + 86400000; 
    const newPendingState = { task: newTask, endTime: endTimeVal, status: "PENDING" };
    setPendingTaskState(newPendingState);
    
    // 3. Update UI
    restorePendingUI();
    if(window.updateTaskUIState) window.updateTaskUIState(true);
    if(window.toggleTaskDetails) window.toggleTaskDetails(true);
    
    // 4. Save to Backend
    window.parent.postMessage({ type: "savePendingState", pendingState: newPendingState, consumeQueue: true }, "*");
    setTimeout(() => { setIgnoreBackendUpdates(false); }, 5000);
}

export function restorePendingUI() {
    if (resetUiTimer) { clearTimeout(resetUiTimer); setResetUiTimer(null); }
    if (cooldownInterval) clearInterval(cooldownInterval);
    
    // UI IDs for 30/40/30 Layout
    const mainBtns = document.getElementById('mainButtonsArea');
    if(mainBtns) mainBtns.classList.add('hidden');
    
    const uploadBtn = document.getElementById('uploadBtnContainer');
    if(uploadBtn) uploadBtn.classList.remove('hidden');
    const timerRow = document.getElementById('activeTimerRow');
    if(timerRow) timerRow.classList.remove('hidden');
    const idleMsg = document.getElementById('idleMessage');
    if(idleMsg) idleMsg.classList.add('hidden');

    const taskEl = document.getElementById('readyText');
    if (taskEl && currentTask) {
        taskEl.innerHTML = currentTask.text;
    }
    
    // Timer Logic
    const targetTime = parseInt(pendingTaskState?.endTime);
    if (!targetTime) return;

    const newInterval = setInterval(() => {
        const diff = targetTime - Date.now();
        if (diff <= 0) {
            clearInterval(newInterval);
            setCooldownInterval(null);
            const td = document.getElementById('timerDisplay');
            if(td) td.textContent = "00:00:00";
            applyPenaltyFail("TIMEOUT");
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

function applyPenaltyFail(reason) {
    triggerSound('sfx-deny');
    const newBalance = Math.max(0, gameStats.coins - 300);
    setGameStats({ coins: newBalance });
    const coinsEl = document.getElementById('coins');
    if (coinsEl) coinsEl.textContent = newBalance;

    // Send data to backend (but NOT to chat via backend echo)
    window.parent.postMessage({ 
        type: "taskSkipped", 
        taskTitle: currentTask ? currentTask.text : "Unknown Task",
        reason: reason
    }, "*");

    finishTask(false);
}

// --- RESULT HANDLER (CHAT ONLY) ---
export function finishTask(success) {
    if (cooldownInterval) clearInterval(cooldownInterval);
    setTaskJustFinished(true);
    setPendingTaskState(null);
    setCooldownInterval(null);
    
    // Close the drawer immediately so they see the chat
    if(window.toggleTaskDetails) window.toggleTaskDetails(false);

    if (success) {
        // GREEN SUCCESS MESSAGE
        injectChatMessage(true, "DIRECTIVE COMPLETE");
    } else {
        // RED FAILURE MESSAGE + TRASH TALK (No Task Text)
        const trashList = (window.CMS_HIERARCHY && window.CMS_HIERARCHY.trash) 
                          ? window.CMS_HIERARCHY.trash 
                          : DEFAULT_TRASH;
        const insult = trashList[Math.floor(Math.random() * trashList.length)];
        
        // Clean HTML: Status + Coin Loss + Insult
        const failMsg = `FAILURE RECORDED (-300 🪙)<br><span style="font-style:italic; opacity:0.7; font-size:0.8em; margin-top:5px; display:block;">"${insult}"</span>`;
        injectChatMessage(false, failMsg);
    }
    
    resetTaskDisplay(success);
    setTimeout(() => { setTaskJustFinished(false); setIgnoreBackendUpdates(false); }, 5000);
}

// Helper to push HTML directly to chat
function injectChatMessage(isSuccess, htmlContent) {
    const chatBox = document.getElementById('chatContent');
    if (!chatBox) return;

    const cssClass = isSuccess ? "sys-gold" : "sys-red";
    
    const msgHTML = `
        <div class="msg-row system-row">
            <div class="msg-system ${cssClass}">
                ${htmlContent}
            </div>
        </div>`;

    chatBox.innerHTML += msgHTML;
    
    // Force Scroll bottom
    const container = document.getElementById('chatBox');
    if(container) container.scrollTop = container.scrollHeight;
}

export function cancelPendingTask() {
    if (!currentTask) return;
    if (gameStats.coins < 300) {
        triggerSound('sfx-deny');
        alert("You cannot afford the 300 coin skip fee.");
        return;
    }
    applyPenaltyFail("MANUAL_SKIP");
}

export function resetTaskDisplay(success) {
    // Return UI to Idle State
    if(window.updateTaskUIState) window.updateTaskUIState(false);
    
    const tc = document.getElementById('readyText');
    if(tc) {
        const color = success ? '#c5a059' : '#8b0000';
        const text = success ? 'COMPLETE' : 'FAILED';
        tc.innerHTML = `<span style="color:${color}">${text}</span>`;
    }
    
    setCurrentTask(null);
    
    const timer = setTimeout(() => {
        if(tc) tc.innerText = "AWAITING ORDERS";
        setResetUiTimer(null);
    }, 4000);
    
    setResetUiTimer(timer);
}
