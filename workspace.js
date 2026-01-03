const supabaseUrl = 'https://pkktiavfwufuiunxllux.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBra3RpYXZmd3VmdWl1bnhsbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDYyOTQsImV4cCI6MjA4MzAyMjI5NH0.5fEWMjqebQ41fVf0jpt5IIPb5cYo9xEaqBqDHC-VPko';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const toolButtons = document.querySelectorAll('.tool-btn');
const eraserOptions = document.getElementById('eraser-options');
const clearAllBtn = document.getElementById('clear-all-btn');

let isDrawing = false;
let currentTool = 'pencil'; 
let lastX = 0;
let lastY = 0;
let currentSize = 3;
let currentColor = '#f5c26b';
let snapshot;
const sizeSlider = document.getElementById('size-slider');
const swatches = document.querySelectorAll('.color-swatch');
const settingsPanel = document.getElementById('tool-settings-panel');
const shapeSelectorGroup = document.getElementById('shape-selector-group');

// 1. Initialize Canvas Settings
function setupCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f5c26b'; 
    ctx.lineWidth = 3;
}

// 2. Tool Selection
toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        toolButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentTool = btn.getAttribute('title').toLowerCase();

        if(currentTool === 'pencil' || currentTool === 'eraser' || currentTool === 'shapes') {
            settingsPanel.classList.remove('hidden');
        } else {
            settingsPanel.classList.add('hidden');
        }

        // Toggle the sub-menu visibility
        if (currentTool === 'eraser') {
            eraserOptions.classList.remove('hidden');
        } else {
            eraserOptions.classList.add('hidden');
        }

        if(currentTool === 'shapes') {
            shapeSelectorGroup.classList.remove('hidden');
        } else {
            shapeSelectorGroup.classList.add('hidden');
        }
    });
});

// Hide settings panel when clicking outside
canvas.addEventListener('mousedown', (e) => {
    // Only hide if the click is actually on the canvas, not the UI
    settingsPanel.classList.add('hidden');
    
    // Existing startDrawing logic...
    startDrawing(e);
});

// 3. Stop clicks inside the settings panel from closing itself
settingsPanel.addEventListener('mousedown', (e) => {
    e.stopPropagation(); 
});

//Size Slider
sizeSlider.addEventListener('input', (e) => {
    currentSize = e.target.value;
});

//Color Changes
swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        currentColor = swatch.getAttribute('data-color');
        
        // Auto-switch to pencil if a color is picked
        if (currentTool === 'eraser') {
            document.querySelector('[title="Pencil"]').click();
        }
    });
});
// 3. Drawing Logic
function startDrawing(e) {
    // Only draw if tool is pencil OR eraser
    if (currentTool !== 'pencil' && currentTool !== 'eraser' && currentTool !== 'shapes' && currentTool !== 'text') return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (currentTool === 'text') {
        // 1. Capture the text input
        const userText = prompt("Enter your blueprint label:");
        
        if (userText) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = currentColor; // Use current selected color
            // Set font size based on the slider value
            ctx.font = `${currentSize * 5}px Cinzel, serif`; 
            ctx.fillText(userText, mouseX, mouseY);
            
        }
        return;
    }
    
    isDrawing = true;
    
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    settingsPanel.classList.add('hidden');
}

let selectedShape = 'rect';
const shapeButtons = document.querySelectorAll('.shape-btn');
shapeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        shapeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedShape = btn.getAttribute('data-shape');
    });
});

function drawArrow(ctx, fromx, fromy, tox, toy) {
    const headlen = 15; // length of head in pixels
    const angle = Math.atan2(toy - fromy, tox - fromx);
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'shapes') {
        ctx.putImageData(snapshot, 0, 0); // Clear preview
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.globalCompositeOperation = 'source-over';

        if (selectedShape === 'rect') {
            ctx.strokeRect(lastX, lastY, x - lastX, y - lastY);
        } else if (selectedShape === 'line') {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else if (selectedShape === 'circle') {
            const radius = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
            ctx.beginPath();
            ctx.arc(lastX, lastY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (selectedShape === 'arrow') {
            drawArrow(ctx, lastX, lastY, x, y);
        }
    } else{
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);

    // Switch between "Drawing" and "Carving out"
        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = currentSize*5;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentSize;
        }
        ctx.stroke();
        lastX = x;
        lastY = y;
    }

    
}

// 4. Clear All Logic
clearAllBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents the tool selection from firing
    if (confirm("Sweep the entire forge clean?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
});

function stopDrawing() {
    isDrawing = false;
}

// Listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
window.addEventListener('resize', setupCanvas);

setupCanvas();
lucide.createIcons();