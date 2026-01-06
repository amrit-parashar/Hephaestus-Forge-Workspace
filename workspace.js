const supabaseUrl = 'https://pkktiavfwufuiunxllux.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBra3RpYXZmd3VmdWl1bnhsbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDYyOTQsImV4cCI6MjA4MzAyMjI5NH0.5fEWMjqebQ41fVf0jpt5IIPb5cYo9xEaqBqDHC-VPko';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const canvas = document.getElementById('main-canvas');
const ctx = canvas.getContext('2d');
const toolButtons = document.querySelectorAll('.tool-btn');
const eraserOptions = document.getElementById('eraser-options');
const clearAllBtn = document.getElementById('clear-all-btn');
const navDownloadBtn = document.getElementById('nav-download-btn');
const projectTitle = document.querySelector('.project-title');

let currentProjectId = null;
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
let idleTimer;
const IDLE_LIMIT = 15 * 60 * 1000;
let collabChannel = null;
let remoteCursors = {}; // Stores x, y, and color for other users
let currentUserEmail=null;

const sizeSlider = document.getElementById('size-slider');
const swatches = document.querySelectorAll('.color-swatch');
const settingsPanel = document.getElementById('tool-settings-panel');
const shapeSelectorGroup = document.getElementById('shape-selector-group');
const uploadBtn = document.getElementById('upload-btn');
const imageInput = document.getElementById('image-input');
const navNewBtn = document.getElementById('nav-new-btn');
document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);


// Check for active session on page load
async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        currentUserEmail = session.user.email;
        // No user logged in? Send them back to the start
        window.location.href = 'index.html';
    } else {
        // Set the display name in the navbar
        const userNameSpan = document.getElementById('user-display-name');
        if (userNameSpan) {
            userNameSpan.innerText = session.user.email.split('@')[0];
        }
    }
}

checkUserSession();

async function autoSaveAndLogout() {
    console.log("User idle. Forcing auto-save before logout...");
    
    // 1. Show a notification (optional)
    alert("Session expiring due to inactivity. Saving your forge...");

    // 2. Trigger the cloud save
    try {
        await saveForgeToCloud();
    } catch (err) {
        console.error("Auto-save failed:", err);
    }

    // 3. Clear session and redirect
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(autoSaveAndLogout, IDLE_LIMIT);
}


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
                hitFound = true;
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
        saveState();
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
        drawRemoteCursors();

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
async function stopDrawing(e) {
    if (isDrawing && currentTool === 'shapes') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const lastShape=shapes[shapes.length - 1];
        saveState();
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
        saveForgeToCloud(true) 
        if(currentProjectId){
            supabaseClient.rpc('append_shape', {
                project_id: currentProjectId,
                new_shape: lastShape 
            });

            if (collabChannel) {
                collabChannel.send({
                    type: 'broadcast',
                    event: 'new_shape',
                    payload: { shape: lastShape }
            });
            // true = silent auto-save
            }
        }
        // Final redraw to clear the "preview" and draw the stored objects
        redrawCanvas();
        
    }
    if (isDrawing && currentTool === 'pencil') {
        if (currentProjectId) saveForgeToCloud(true);
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

function copyShareLink() {
    const urlInput = document.getElementById('share-url');
    urlInput.select();
    document.execCommand('copy');

    // Visual feedback
    const copyBtn = document.querySelector('.link-box button');
    const originalText = copyBtn.innerText;
    copyBtn.innerText = "Copied!";
    copyBtn.style.background = "#ffffff";

    setTimeout(() => {
        copyBtn.innerText = originalText;
        copyBtn.style.background = "#f5c26b";
    }, 2000);
}

async function checkUrlForSharedProject() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('id');

    if (sharedId) {
        const { data, error } = await supabaseClient
            .from('blueprints')
            .select('*')
            .eq('id', sharedId)
            .single();

        if (data) {
            // Load the board and start collaboration
            currentProjectId = data.id;
            loadProject(data); 
            initializeCollaboration(data.id); 
        } else {
            console.error("Could not find or access this shared board.");
        }
    }
}
checkUrlForSharedProject();
// Listen for Delete or Backspace keys
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    // Check if an object is selected and the key is Delete or Backspace
    if (selectedObjectIndex !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        saveState();
        
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

async function saveForgeToCloud(isAutoSave=false) {
    const fileName = projectTitle.innerText.trim() || "Untitled Blueprint";
    
    // Get the current user session
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        if(!isAutoSave)alert("You must be logged in to save to the cloud!");
        return;
    }
    const savePayload = { 
        title: fileName, 
        data: { 
            shapes: shapes,
            stickies: Array.from(document.querySelectorAll('.sticky-note')).map(s => ({
                text: s.querySelector('textarea').value,
                x: s.style.left,
                y: s.style.top,
                color: s.style.backgroundColor
            }))
        },
        
    };
    let result;
    if (currentProjectId) {
        result = await supabaseClient
            .from('blueprints')
            .update(savePayload)
            .eq('id', currentProjectId)
            .select();
    }else {
        // Only insert a brand new record if there is no current project
        savePayload.user_id = user.id; // Only attach owner ID on creation
        result = await supabaseClient
            .from('blueprints')
            .insert([savePayload])
            .select();
    }

    const { data, error } = await supabaseClient
        .from('blueprints')
        .upsert(savePayload)
        .select(); 

    if (result.error) {
        console.error("Save Error:", error.message);
        alert("Error saving to cloud: " + error.message);
    } else {
        if (result.data && result.data.length > 0) {
            currentProjectId = result.data[0].id;
        }
        if(!isAutoSave)alert("Blueprint forged successfully in the cloud!");
    }
}
const navSaveBtn = document.getElementById('nav-save-btn');

navSaveBtn.addEventListener('click', saveForgeToCloud);

const loadModal = document.getElementById('load-modal');
const blueprintList = document.getElementById('blueprint-list');

// 1. Fetch and Display Blueprints
async function openLoadMenu() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return alert("Please log in to see your blueprints.");

    // Fetch titles and data from Supabase
    const { data, error } = await supabaseClient
        .from('blueprints')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return console.error(error);

    // Build the UI list
    blueprintList.innerHTML = data.length === 0 ? '<p>No saved blueprints found.</p>' : '';
    data.forEach(project => {
        const card = document.createElement('div');
        card.className = 'blueprint-card';
        card.innerHTML = `
        <div class="card-content">
            <h4>${project.title}</h4>
            <span>Saved on: ${new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        <button class="delete-project-btn" title="Delete Blueprint">
            <i data-lucide="trash-2"></i>
        </button>
        `;
        card.onclick = () => loadProject(project);

        const deleteBtn = card.querySelector('.delete-project-btn');
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevents loading the project
            deleteBlueprint(project.id, project.title);
        };
        blueprintList.appendChild(card);
    });

    loadModal.classList.remove('hidden');
    if(typeof lucide !== 'undefined')
        lucide.createIcons();
}

// 2. Reconstruct the Project
async function loadProject(project) {
    if (!confirm(`Load "${project.title}"? Unsaved changes will be lost.`)) return;

    currentProjectId = project.id;
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isOwner = session && session.user.id === project.user_id;
    const canEdit = isOwner || (project.visibility === 'link' && project.public_access_level === 'edit');

    if (!canEdit) {
        // Hide drawing tools for view-only guests
        document.querySelector('.toolbar').style.display = 'none';
        canvas.style.pointerEvents = 'none';
        alert("Entering View-Only mode.");
    } else {
        document.querySelector('.toolbar').style.display = 'flex';
        canvas.style.pointerEvents = 'auto';
    }
    // Clear everything first
    shapes = [];
    document.querySelectorAll('.sticky-note').forEach(n => n.remove());
    projectTitle.innerText = project.title;

    // Restore Shapes
    shapes = project.data.shapes || [];

    // Restore Sticky Notes
    if (project.data.stickies) {
        project.data.stickies.forEach(s => {
            currentStickyColor = s.color;
            createStickyNote(parseInt(s.x), parseInt(s.y));
            // Set the text after creation
            const latestSticky = document.querySelector('.sticky-note:last-child textarea');
            if (latestSticky) latestSticky.value = s.text;
        });
    }

    redrawCanvas();
    loadModal.classList.add('hidden'); // If you have the layers feature implemented
}

async function deleteBlueprint(id, title) {
    if (!confirm(`Are you sure you want to destroy the blueprint for "${title}"? This cannot be undone.`)) return;

    const { error } = await supabaseClient
        .from('blueprints')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error deleting: " + error.message);
    } else {
        // Refresh the menu to show it's gone
        openLoadMenu();
    }
}

let undoStack = [];
let redoStack = [];

// Save the current state before an action happens
function saveState() {
    // We save a deep copy of the shapes array so changes don't affect old snapshots
    // Since images are objects, we map them carefully
    const state = JSON.parse(JSON.stringify(shapes.map(s => {
        if (s.type === 'image') {
            // We don't stringify the imgElement (it would break), 
            // the redrawCanvas uses the original image object logic
            return { ...s, imgElement: s.imgElement };
        }
        return s;
    })));
    
    undoStack.push(state);
    
    // Limit stack size to 50 to save memory
    if (undoStack.length > 50) undoStack.shift();
    
    // Whenever a new action is performed, clear the redo stack
    redoStack = [];
}

function undo() {
    if (undoStack.length === 0) return;

    // Save the current state to Redo before going back
    redoStack.push(JSON.parse(JSON.stringify(shapes)));
    
    // Restore the previous state
    shapes = undoStack.pop();
    selectedObjectIndex = null;
    redrawCanvas();
}

function redo() {
    if (redoStack.length === 0) return;

    // Save current state to Undo before moving forward
    undoStack.push(JSON.parse(JSON.stringify(shapes)));
    
    // Restore the next state
    shapes = redoStack.pop();
    selectedObjectIndex = null;
    redrawCanvas();
}

async function handleLogout() {
    // 1. Confirm with the user so they don't lose unsaved work
    const confirmLogout = confirm("Are you sure you want to leave the Forge? Any unsaved changes will be lost.");
    
    if (confirmLogout) {
        const { error } = await supabaseClient.auth.signOut();
        
        if (error) {
            console.error("Logout Error:", error.message);
            alert("Error logging out: " + error.message);
        } else {
            // 2. Redirect to your login or landing page
            // Replace 'index.html' with your actual login page filename
            window.location.href = 'index.html'; 
        }
    }
}

function initializeCollaboration(projectId) {
    if (collabChannel) supabaseClient.removeChannel(collabChannel);

    // Create a unique channel for this board
    collabChannel = supabaseClient.channel(`room_${projectId}`, {
        config: { broadcast: { self: false } }
    });

    // 1. Listen for mouse movements from others
    collabChannel
        .on('broadcast', { event: 'cursor' }, ({ payload }) => {
            remoteCursors[payload.user] = { x: payload.x, y: payload.y, color: payload.color };
            redrawCanvas(); // Update view
        })

        .on('broadcast', { event: 'new_shape' }, ({ payload }) => {
            shapes.push(payload.shape);
            redrawCanvas();
        })
        // 2. Listen for when someone else SAVES the board
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'blueprints', 
            filter: `id=eq.${projectId}` 
        }, payload => {
            // Replace local shapes with the new remote data
            const remoteShapes = payload.new.data.shapes || [];
            if (remoteShapes.length !== shapes.length) {
                shapes = remoteShapes; 
                redrawCanvas();
            }
            
        })
        .subscribe();
}
function drawRemoteCursors() {
    for (const id in remoteCursors) {
        const cursor = remoteCursors[id];
        ctx.fillStyle = cursor.color;
        
        // Draw a simple circle for the cursor
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 5 / scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Label the cursor with the user's name
        ctx.font = `${12 / scale}px Inter`;
        ctx.fillText(id.split('@')[0], cursor.x + (10 / scale), cursor.y);
    }
}

// CALL THIS INSIDE REDRAWCANVAS() AFTER DRAWING SHAPES

document.getElementById('nav-load-btn').addEventListener('click', openLoadMenu);

document.getElementById('close-load-modal').onclick = () => loadModal.classList.add('hidden');



lucide.createIcons();

// Listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', (e) =>{ 
    draw(e);
    if (currentProjectId && collabChannel) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        collabChannel.send({
            type: 'broadcast',
            event: 'cursor',
            payload: { 
                user: currentUserEmail, // Get this from auth
                x: mouseX, 
                y: mouseY, 
                color: currentColor 
            }
        });
    

    }

});

// Add these to the bottom of workspace.js
const shareModal = document.getElementById('share-modal');
const navShareBtn = document.getElementById('nav-share-btn');

if (navShareBtn) {
    navShareBtn.onclick = () => {
        if (!currentProjectId) {
            alert("Please save your forge to the cloud before sharing!");
            return;
        }
        // Update the URL input before showing
        document.getElementById('share-url').value = `${window.location.origin}${window.location.pathname}?id=${currentProjectId}`;
        shareModal.classList.remove('hidden');
    };
}

document.getElementById('close-share-modal').onclick = () => shareModal.classList.add('hidden');
async function updatePermissions() {
    if (!currentProjectId) return;
    
    const visibility = document.getElementById('share-visibility').value;
    const access = document.getElementById('share-permission').value;

    const { error } = await supabaseClient
        .from('blueprints')
        .update({ 
            visibility: visibility, 
            public_access_level: access 
        })
        .eq('id', currentProjectId);

    if (error) console.error("Error updating permissions:", error.message);
}

// Ensure visibility and permission changes save instantly
document.getElementById('share-visibility').onchange = updatePermissions;
document.getElementById('share-permission').onchange = updatePermissions;
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
window.addEventListener('resize', setupCanvas);
navNewBtn.addEventListener('click', () => {
    if (confirm("Start a new blueprint? Ensure you have saved your current work to the cloud.")) {
        currentProjectId = null;
        // 1. Reset the logic state

        shapes = [];
        selectedObjectIndex = null;
        projectTitle.innerText = `Blueprint ${new Date().toLocaleTimeString()}`;
        
        // 2. Reset the UI
        projectTitle.innerText = "Untitled Blueprint";
        
        // 3. Clear the physical canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 4. Remove all sticky notes
        document.querySelectorAll('.sticky-note').forEach(note => note.remove());
        redrawCanvas();
        
        console.log("New forge started.");
    }
});

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// Monitor these events to know the user is still active
const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

activityEvents.forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, true);
});

// Start the timer for the first time when the page loads
resetIdleTimer();

setupCanvas();
lucide.createIcons();