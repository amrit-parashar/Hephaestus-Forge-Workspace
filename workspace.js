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
let currentStickyColor = '#fff9c4';
let shapes = []; // Stores objects like { type: 'rect', x: 10, y: 10, w: 50, h: 50, color: '#gold' }
let selectedObjectIndex = null;
let isDraggingObject = false;
let dragOffX, dragOffY;
const sizeSlider = document.getElementById('size-slider');
const swatches = document.querySelectorAll('.color-swatch');
const settingsPanel = document.getElementById('tool-settings-panel');
const shapeSelectorGroup = document.getElementById('shape-selector-group');
const uploadBtn = document.getElementById('upload-btn');
const imageInput = document.getElementById('image-input');


// 1. Initialize Canvas Settings
function setupCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#f5c26b'; 
    ctx.lineWidth = 3;
}

// Tool Selection
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

        if(currentTool === 'sticky note') {
            stickySettings.classList.remove('hidden');
        } else {
            stickySettings.classList.add('hidden');
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

//Stop clicks inside the settings panel from closing itself
settingsPanel.addEventListener('mousedown', (e) => {
    e.stopPropagation(); 
});

//Size Slider
sizeSlider.addEventListener('input', (e) => {
    currentSize = e.target.value;
});

//Image Upload

uploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Calculate scale to fit image within the view if it's too large
            const maxWidth = canvas.width * 0.8;
            const maxHeight = canvas.height * 0.8;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            const imageObj = {
                type: 'image',
                imgElement: img, // Store the actual image element
                x: (canvas.width - width) / 2,
                y: (canvas.height - height) / 2,
                w: width,
                h: height
            };

            shapes.push(imageObj); // Save it so it's not erased
            redrawCanvas(); // Render the scene with the new image
        
        };
        img.src = event.target.result;
    };
    
    reader.readAsDataURL(file);
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
// Drawing Logic
function startDrawing(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (currentTool === 'sticky note') {
        createStickyNote(e.pageX, e.pageY);
        return;
    }

    if (currentTool === 'select') {
        selectedObjectIndex=null;
        let hitFound = false;
        // Iterate backwards to grab the top-most object first
        for (let i = shapes.length - 1; i >= 0; i--) {
            const s = shapes[i];
            console.log(`Tool: SELECT | Mouse: ${mouseX}, ${mouseY} | Shape [${i}]: x:${s.x}, y:${s.y}, w:${s.w}, h:${s.h}`);
            
            // Basic bounding box check for rectangles/images
            if (mouseX >= s.x && mouseX <= s.x + s.w && 
                mouseY >= s.y && mouseY <= s.y + s.h) {
                
                selectedObjectIndex = i;
                isDraggingObject = true;
                dragOffX = mouseX - s.x; // Calculate offset to prevent "snapping"
                dragOffY = mouseY - s.y;
                let hitFound = true;
                return;
            }
        }
        if (!hitFound) {
        selectedObjectIndex = null; // Deselect if clicking empty space
        }
        selectedObjectIndex = null; // Clicked empty space
        redrawCanvas();
        return;
    }
    
    // Only draw if tool is pencil OR eraser
    if (currentTool !== 'pencil' && currentTool !== 'eraser' && currentTool !== 'shapes') return;
    
    
    
    isDrawing = true;
    
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    settingsPanel.classList.add('hidden');

    if (currentTool === 'pencil') {
        shapes.push({
            type: 'path',
            points: [{ x: mouseX, y: mouseY }],
            color: currentColor,
            size: currentSize
        });
    }
}

// Shape Selection

let selectedShape = 'rect';
const shapeButtons = document.querySelectorAll('.shape-btn');
shapeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        shapeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedShape = btn.getAttribute('data-shape');
    });
});
// Draw Arrow Function
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
    if (!isDrawing && !isDraggingObject) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'select' && isDraggingObject && selectedObjectIndex !== null) {
        // Move the shape coordinates based on mouse position
        shapes[selectedObjectIndex].x = x - dragOffX;
        shapes[selectedObjectIndex].y = y - dragOffY;
        
        redrawCanvas(); 
        return;
    }

    //Drawing Shapes

    if (currentTool === 'shapes' && isDrawing) {
        ctx.putImageData(snapshot, 0, 0); 
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
        // Freehand Drawing
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);

    
        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = currentSize*5;
        } 
        if (isDrawing &&currentTool === 'pencil') {
            const currentPath = shapes[shapes.length - 1];
            currentPath.points.push({ x: x, y: y });
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentSize;
        }
        ctx.stroke();
        lastX = x;
        lastY = y;
    }

    
}
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    shapes.forEach((s, index) => {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.globalCompositeOperation = 'source-over';

        if (s.type === 'image') {
            ctx.drawImage(s.imgElement, s.x, s.y, s.w, s.h);
        }

        if (s.type === 'path') {
            ctx.beginPath();
            ctx.moveTo(s.points[0].x, s.points[0].y);
            for (let i = 1; i < s.points.length; i++) {
                ctx.lineTo(s.points[i].x, s.points[i].y);
            }
            ctx.stroke();
        }

        else if (s.type === 'rect') {
            ctx.strokeRect(s.x, s.y, s.w, s.h);
        }
        else if (s.type === 'circle') {
            ctx.beginPath();
            const radius = Math.sqrt(s.w * s.w + s.h * s.h);
            ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        else if (s.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x + s.w, s.y + s.h);
            ctx.stroke();
        } else if (s.type === 'arrow') {
            drawArrow(ctx, s.x, s.y, s.x + s.w, s.y + s.h);
        }
        // ... add cases for circles, lines, and images ...

        // Draw a selection highlight
        if (index === selectedObjectIndex) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#4ecdc4'; // Highlight color
            ctx.strokeRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
            ctx.setLineDash([]);
        }
    });
}

// Erase All 
clearAllBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevents the tool selection from firing
    if (confirm("Sweep the entire forge clean?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        shapes = [];
        selectedObjectIndex = null;
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
});

// Ensure 'e' is passed as a parameter to get the final mouse position
function stopDrawing(e) {
    if (isDrawing && currentTool === 'shapes') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Commit the shape to memory
        shapes.push({
            type: selectedShape,
            x: lastX,
            y: lastY,
            w: mouseX - lastX,
            h: mouseY - lastY,
            color: currentColor,
            size: currentSize
        });
        
        // Final redraw to clear the "preview" and draw the stored objects
        redrawCanvas();
    }
    
    isDrawing = false;
    isDraggingObject = false;
}

//Sticky Note Color
document.querySelectorAll('.s-color').forEach(color => {
    color.addEventListener('click', () => {
        currentStickyColor = color.getAttribute('data-color');
        document.querySelectorAll('.s-color').forEach(c => c.style.border = 'none');
        color.style.border = '2px solid white';
    });
});

//Sticky Note Tool

function createStickyNote(x, y) {
    const sticky = document.createElement('div');
    sticky.className = 'sticky-note';
    sticky.style.left = `${x}px`;
    sticky.style.top = `${y}px`;
    sticky.style.backgroundColor = currentStickyColor;

    const header = document.createElement('div');
    
    header.className = 'sticky-header';
    header.innerHTML = `
        <div class="sticky-tools">
            <select class="s-font-size">
                <option value="12px" selected>12</option>
                <option value="14px">14</option>
                <option value="20px">20</option>
                <option value="26px">26</option>
            </select>
            <input type="color" class="s-color-picker" value="${currentStickyColor}">
        </div>
        <button class="delete-sticky">×</button>
    `;
    header.querySelector('.sticky-tools').addEventListener('mousedown', (e) => {
        e.stopPropagation(); 
    });

    // Create the text area inside
    const textarea = document.createElement('textarea');
    textarea.placeholder = "Write a note...";
    sticky.appendChild(header);
    sticky.appendChild(textarea);
    document.body.appendChild(sticky);

    const colorPicker = header.querySelector('.s-color-picker');
    colorPicker.addEventListener('input', (e) => {
        sticky.style.backgroundColor = e.target.value;
    });

    const fontSize = header.querySelector('.s-font-size');
    fontSize.addEventListener('change', (e) => {
        textarea.style.fontSize = e.target.value;
    });

    header.querySelector('.delete-sticky').onclick = () => sticky.remove();
    const selectBtn = document.querySelector('[title="Select"]'); 
    
    if (selectBtn) {
        selectBtn.click(); // This triggers your existing tool selection logic
    } else {
        // Fallback: Manually update state if button isn't found
        currentTool = 'select';
        toolButtons.forEach(b => b.classList.remove('active'));
    }
    
    // Make it draggable (Simple version)
    makeElementDraggable(sticky, header);
}

function makeElementDraggable(elmnt, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Use the header as the drag handle only
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}
// Listen for Delete or Backspace keys
window.addEventListener('keydown', (e) => {
    // Check if an object is selected and the key is Delete or Backspace
    if (selectedObjectIndex !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        
        // Prevent backspace from navigating the browser back
        e.preventDefault();

        // Remove the selected object from the shapes array
        shapes.splice(selectedObjectIndex, 1);

        // Reset the selection index since the object is gone
        selectedObjectIndex = null;

        // Redraw the canvas to show the updated state
        redrawCanvas();
        
        console.log("Object deleted from the forge.");
    }
});



// Example: Attach to a button with id 'download-btn'
const navDownloadBtn = document.getElementById('nav-download-btn');
const projectTitle = document.querySelector('.project-title');
navDownloadBtn.addEventListener('click', () => {
    // 1. Hide selection highlight so it's not in the export
    const tempSelection = selectedObjectIndex;
    selectedObjectIndex = null;
    redrawCanvas();

    // 2. Prepare the link
    const link = document.createElement('a');
    
    // Use the project title as the filename, default to 'blueprint' if empty
    const fileName = projectTitle.innerText.trim() || "untitled-blueprint";
    link.download = `${fileName}.png`;
    
    // 3. Convert and trigger
    link.href = canvas.toDataURL("image/png");
    link.click();

    // 4. Restore selection highlight
    selectedObjectIndex = tempSelection;
    redrawCanvas();
});

async function saveForgeToCloud() {
    const fileName = projectTitle.innerText.trim() || "Untitled Blueprint";
    
    // Get the current user session
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        alert("You must be logged in to save to the cloud!");
        return;
    }

    const { data, error } = await supabaseClient
        .from('blueprints')
        .upsert({ 
            title: fileName, 
            data: { 
                shapes: shapes,
                // We convert sticky notes to a simple array of objects
                stickies: Array.from(document.querySelectorAll('.sticky-note')).map(s => ({
                    text: s.querySelector('textarea').value,
                    x: s.style.left,
                    y: s.style.top,
                    color: s.style.backgroundColor
                }))
            },
            user_id: user.id 
        }, { onConflict: 'title, user_id' }); // Overwrites if the title exists for this user

    if (error) {
        console.error("Save Error:", error.message);
        alert("Error saving to cloud: " + error.message);
    } else {
        alert("Blueprint forged successfully in the cloud!");
    }
}
const navSaveBtn = document.getElementById('nav-save-btn');

navSaveBtn.addEventListener('click', saveForgeToCloud);

// Refresh icons so the cloud-upload shows up
lucide.createIcons();

// Listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
window.addEventListener('resize', setupCanvas);

setupCanvas();
lucide.createIcons();