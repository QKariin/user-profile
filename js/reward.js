// js/reward.js - THE REVEAL ENGINE
import { activeRevealMap, currentLibraryMedia, libraryProgressIndex } from './state.js';
import { getOptimizedUrl, triggerSound } from './utils.js';

// --- 1. THE GRID RENDERER (Draws the 3x3 frosted glass) ---
export function renderRewardGrid() {
    const gridContainer = document.getElementById('revealGridContainer');
    if (!gridContainer || !currentLibraryMedia) return;

    const isVideo = currentLibraryMedia.match(/\.(mp4|mov|webm)/i);
    const mediaHtml = isVideo 
        ? `<video src="${currentLibraryMedia}" autoplay loop muted playsinline class="reveal-bg-media"></video>`
        : `<img src="${getOptimizedUrl(currentLibraryMedia, 800)}" class="reveal-bg-media">`;

    let gridHtml = '<div class="reveal-grid-overlay">';
    for (let i = 1; i <= 9; i++) {
        const isUnblurred = activeRevealMap.includes(i);
        gridHtml += `
            <div class="reveal-square ${isUnblurred ? 'clear' : 'frosted'}" id="sq-${i}">
                ${!isUnblurred ? `<span class="sq-num">${i}</span>` : ''}
            </div>`;
    }
    gridHtml += '</div>';

    gridContainer.innerHTML = mediaHtml + gridHtml;
    
    const label = document.getElementById('revealLevelLabel');
    if (label) label.innerText = `LEVEL ${libraryProgressIndex} CONTENT`;
}

// --- 2. THE REVEAL FRAGMENT BUTTON (The 3rd Option) ---
export function handleRevealFragment() {
    // Sends the instruction to your Wix Velo to pick a random square
    window.parent.postMessage({ type: "REVEAL_FRAGMENT" }, "*");
    
    // Closes the window (separately as you wanted)
    const rewardMenu = document.getElementById('kneelRewardOverlay');
    if (rewardMenu) rewardMenu.classList.add('hidden');
    
    triggerSound('coinSound');
}

// --- 3. THE IPHONE SLIDER ENGINE (For Points/Coins) ---
let isDragging = false;
let currentSlider = null;
let startX = 0;

export function initSlider(e, choice) {
    if (isDragging) return;
    isDragging = true;
    currentSlider = e.currentTarget;
    
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    
    const moveHandler = (moveEvent) => {
        const clientX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const knob = currentSlider.querySelector('.slider-knob');
        const fill = currentSlider.querySelector('.slider-fill');
        const text = currentSlider.querySelector('.slider-track-text');
        
        const trackWidth = currentSlider.offsetWidth - knob.offsetWidth - 10;
        let moveX = clientX - startX;
        moveX = Math.max(0, Math.min(moveX, trackWidth));
        const percent = (moveX / trackWidth) * 100;

        knob.style.transform = `translateX(${moveX}px)`;
        fill.style.width = `${percent}%`;
        if (text) text.style.opacity = 1 - (percent / 100);

        // TRIGGER REWARD: If they slide 98% of the way
        if (percent >= 98) {
            isDragging = false;
            stopHandlers();
            
            // This calls your separate reward function in kneeling.js
            import('./kneeling.js').then(({ claimKneelReward }) => {
                claimKneelReward(choice);
            });
        }
    };

    const stopHandlers = () => {
        if (!isDragging) return;
        isDragging = false;
        
        // Snap back if they let go early
        const knob = currentSlider.querySelector('.slider-knob');
        const fill = currentSlider.querySelector('.slider-fill');
        const text = currentSlider.querySelector('.slider-track-text');
        
        knob.style.transition = "transform 0.3s ease";
        fill.style.transition = "width 0.3s ease";
        knob.style.transform = "translateX(0)";
        fill.style.width = "0%";
        if (text) text.style.opacity = "1";
        
        setTimeout(() => {
            knob.style.transition = "none";
            fill.style.transition = "none";
        }, 300);

        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('mouseup', stopHandlers);
        document.removeEventListener('touchend', stopHandlers);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('mouseup', stopHandlers);
    document.addEventListener('touchend', stopHandlers);
}

// Global Bindings
window.handleRevealFragment = handleRevealFragment;
window.initSlider = initSlider;
