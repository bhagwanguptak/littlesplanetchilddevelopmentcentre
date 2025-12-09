const API_BASE = '';
let aboutEditor, admissionEditor;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    // --- CKEDITOR CONFIGURATION (Super Build) ---
    const editorConfig = {
        toolbar: {
            items: [
                'heading', '|',
                'bold', 'italic', 'underline', 'strikethrough', '|',
                'fontColor', 'fontBackgroundColor', '|', 
                'bulletedList', 'numberedList', '|',
                'outdent', 'indent', '|',
                'undo', 'redo', '|',
                'link', 'blockQuote', 'insertTable'
            ],
            shouldNotGroupWhenFull: true
        },
        // ★ IMPORTANT: Disable all Premium/Pro features to stop License Errors ★
        removePlugins: [
            // Premium Features (Require License) - CAUSING YOUR ERRORS
            'AIAssistant',
            'CKBox',
            'CKFinder',
            'EasyImage',
            'RealTimeCollaborativeComments',
            'RealTimeCollaborativeTrackChanges',
            'RealTimeCollaborativeRevisionHistory',
            'PresenceList',
            'Comments',
            'TrackChanges',
            'TrackChangesData',
            'RevisionHistory',
            'Pagination',
            'WProofreader',
            'MathType',
            'SlashCommand',
            'Template',
            'FormatPainter',
            'PasteFromOfficeEnhanced',
            'CaseChange',
            'DocumentOutline',
            'TableOfContents',
            'ExportPdf',
            'ExportWord',
            'ImportWord',
            'MultiLevelList',
            'TextPartLanguage'
        ]
    };

    // Initialize Editors
    if (document.querySelector('#aboutUsTextEditor')) {
        try {
            aboutEditor = await CKEDITOR.ClassicEditor.create(document.querySelector('#aboutUsTextEditor'), editorConfig);
        } catch (e) { console.error("About Editor init failed", e); }
    }
    if (document.querySelector('#admission-editor')) {
        try {
            admissionEditor = await CKEDITOR.ClassicEditor.create(document.querySelector('#admission-editor'), editorConfig);
        } catch (e) { console.error("Admission Editor init failed", e); }
    }

    await loadAdminData();
});

// --- API Helper ---
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    if (!(options.body instanceof FormData)) options.headers['Content-Type'] = 'application/json';
    
    const res = await fetch(url, options);
    if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
        throw new Error('Unauthorized');
    }
    return res.json();
}

// --- Load Data ---
async function loadAdminData() {
    try {
        const settings = await apiFetch('/api/settings');
        
        // Load others safely
        let services = [], testimonials = [], carousel = [];
        try { services = await apiFetch('/api/services'); } catch(e){ console.error('Services load error', e); }
        try { testimonials = await apiFetch('/api/testimonials'); } catch(e){ console.error('Testimonials load error', e); }
        try { carousel = await apiFetch('/api/carousel'); } catch(e){ console.error('Carousel load error', e); }

        // 1. General Settings
        if(settings) {
            document.getElementById('schoolName').value = settings.schoolName || '';
            document.getElementById('school-tagline').value = settings.schoolTagline || '';
            document.getElementById('topHeaderPhone').value = settings.topHeaderPhone || '';
            document.getElementById('topHeaderEmail').value = settings.topHeaderEmail || '';
            document.getElementById('currentLogoURL').value = settings.logoURL || '';
            
            if(settings.logoURL) {
                document.getElementById('logoPreviewAdmin').src = settings.logoURL;
                document.getElementById('logoPreviewAdmin').style.display = 'block';
            }
            if(aboutEditor) aboutEditor.setData(settings.aboutUsText || '');
            if(admissionEditor) admissionEditor.setData(settings.admission || '');

       
            if(settings.themePrimary) {
                document.getElementById('themePrimary').value = settings.themePrimary;
                document.getElementById('themePrimaryText').value = settings.themePrimary;
            }
            if(settings.themeSecondary) {
                document.getElementById('themeSecondary').value = settings.themeSecondary;
                document.getElementById('themeSecondaryText').value = settings.themeSecondary;
            }
        
            
            // ★★★ FIX: Handle Object vs String correctly here ★★★
            renderVisibilityToggles(settings.sectionVisibility);
        }

        renderServicesList(services);
        renderTestimonialsList(testimonials);
        renderCarouselList(carousel);

    } catch (e) { 
        console.error("CRITICAL LOAD ERROR", e); 
        alert("Error loading data. Check console.");
    }
}

// --- Visibility Logic (FIXED) ---
function renderVisibilityToggles(visData) {
    // Default to true
    let visibility = { hero: true, about: true, services: true, admissions: true, testimonials: true, contact: true }; 
    
    // ★ FIX: Check if it's a string before parsing
    if (visData) {
        if (typeof visData === 'string') {
            try { visData = JSON.parse(visData); } catch(e) { console.warn("Vis parse error", e); }
        }
        // Merge saved data into defaults
        visibility = { ...visibility, ...visData };
    }
    
    const sections = ['hero', 'about', 'services', 'admissions', 'testimonials', 'contact'];
    const container = document.getElementById('visibilityContainer');
    
    container.innerHTML = sections.map(sec => `
        <div class="col-md-2 col-4 mb-3 text-center">
            <div class="form-check form-switch d-flex flex-column align-items-center">
                <input class="form-check-input" type="checkbox" id="toggle_${sec}" style="width: 3em; height: 1.5em;" ${visibility[sec] ? 'checked' : ''}>
                <label class="form-check-label d-block small fw-bold text-uppercase mt-2" for="toggle_${sec}">${sec}</label>
            </div>
        </div>
    `).join('');
}

function getVisibilityState() {
    const sections = ['hero', 'about', 'services', 'admissions', 'testimonials', 'contact'];
    let state = {};
    sections.forEach(sec => {
        const el = document.getElementById(`toggle_${sec}`);
        // If element exists, use checked state.
        if (el) state[sec] = el.checked;
    });
    // We send an Object. The server handles stringifying if needed.
    return state; 
}

// --- Services (Cards) ---
async function addService() {
    const title = document.getElementById('newServiceTitle').value;
    const desc = document.getElementById('newServiceDesc').value;
    const icon = document.getElementById('newServiceIcon').value;
    const file = document.getElementById('newServiceImage').files[0];

    if(!title) return alert('Title is required');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', desc);
    formData.append('icon_class', icon);
    if (file) formData.append('image', file);

    const btn = document.querySelector('button[onclick="addService()"]');
    btn.disabled = true; btn.innerText = "Adding...";
    try {
        await apiFetch('/api/services', { method: 'POST', body: formData });
        // Clear inputs
        document.getElementById('newServiceTitle').value = '';
        document.getElementById('newServiceDesc').value = '';
        document.getElementById('newServiceImage').value = '';
        document.getElementById('newServiceIcon').value = '';
        const services = await apiFetch('/api/services');
        renderServicesList(services);
    } catch(e) { alert("Failed to add service"); }
    btn.disabled = false; btn.innerHTML = '<i class="bi bi-plus-lg"></i> Add Service';
}

async function deleteService(id) {
    if(confirm('Delete this service card?')) {
        await apiFetch(`/api/services/${id}`, { method: 'DELETE' });
        const services = await apiFetch('/api/services');
        renderServicesList(services);
    }
}

function renderServicesList(services) {
    const list = document.getElementById('servicesList');
    if(!services || services.length === 0) {
        list.innerHTML = '<div class="col-12 text-center text-muted">No services added yet.</div>';
        return;
    }
    list.innerHTML = services.map(s => `
        <div class="col-md-4">
            <div class="list-item-custom">
                <button onclick="deleteService(${s.id})" class="btn-delete-item btn btn-sm btn-danger">&times;</button>
                <div class="d-flex align-items-center mb-2">
                    ${s.image_url 
                        ? `<img src="${s.image_url}" style="width:40px;height:40px;border-radius:5px;object-fit:cover;margin-right:10px;">` 
                        : `<i class="bi ${s.icon_class || 'bi-star'} fs-4 text-primary me-2"></i>`
                    }
                    <strong class="text-truncate">${s.title}</strong>
                </div>
                <small class="d-block text-muted" style="height:40px; overflow:hidden;">${s.description}</small>
            </div>
        </div>
    `).join('');
}

// --- Testimonials ---
async function addTestimonial() {
    const name = document.getElementById('newTestimonialName').value;
    const role = document.getElementById('newTestimonialRole').value;
    const msg = document.getElementById('newTestimonialMsg').value;

    if(!name || !msg) return alert('Name and Message required');
    
    try {
        await apiFetch('/api/testimonials', {
            method: 'POST',
            body: JSON.stringify({ name, role, message: msg })
        });
        document.getElementById('newTestimonialName').value = '';
        document.getElementById('newTestimonialRole').value = '';
        document.getElementById('newTestimonialMsg').value = '';
        const list = await apiFetch('/api/testimonials');
        renderTestimonialsList(list);
    } catch(e) { alert("Failed to add testimonial."); }
}

async function deleteTestimonial(id) {
    if(confirm('Delete review?')) {
        await apiFetch(`/api/testimonials/${id}`, { method: 'DELETE' });
        const list = await apiFetch('/api/testimonials');
        renderTestimonialsList(list);
    }
}

function renderTestimonialsList(list) {
    const container = document.getElementById('testimonialsList');
    if(!list || list.length === 0) {
         container.innerHTML = '<div class="col-12 text-center text-muted">No testimonials yet.</div>';
         return;
    }
    container.innerHTML = list.map(t => `
        <div class="col-md-4">
            <div class="list-item-custom">
                <button onclick="deleteTestimonial(${t.id})" class="btn-delete-item btn btn-sm btn-danger">&times;</button>
                <strong>${t.name}</strong> <span class="small text-muted">(${t.role || 'Parent'})</span>
                <p class="small mb-0 text-muted fst-italic">"${t.message.substring(0,50)}..."</p>
            </div>
        </div>
    `).join('');
}

// --- Carousel ---
async function uploadCarouselImage() {
    const file = document.getElementById('carousel-image-upload').files[0];
    if(!file) return alert('Choose an image');

    const btn = document.querySelector('button[onclick="uploadCarouselImage()"]');
    btn.disabled = true; btn.innerText = "Uploading...";
    
    try {
        const formData = new FormData();
        formData.append('carouselImage', file);
        await apiFetch('/api/carousel', { method: 'POST', body: formData });
        document.getElementById('carousel-image-upload').value = '';
        const carousel = await apiFetch('/api/carousel');
        renderCarouselList(carousel);
    } catch(e) { alert("Upload failed"); }
    btn.disabled = false; btn.innerText = "Upload";
}

async function deleteCarouselImage(id) {
    if(confirm('Delete slide?')) {
        await apiFetch(`/api/carousel/${id}`, { method: 'DELETE' });
        const carousel = await apiFetch('/api/carousel');
        renderCarouselList(carousel);
    }
}

function renderCarouselList(list) {
    const container = document.getElementById('carousel-images-container');
    if(!list || list.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted">No slides.</div>';
        return;
    }
    container.innerHTML = list.map(c => `
        <div class="col-3 position-relative">
            <img src="${c.image_url}" class="img-fluid rounded border" style="width:100%; height:80px; object-fit:cover;">
            <button onclick="deleteCarouselImage(${c.id})" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1" style="padding:0px 6px;">&times;</button>
        </div>
    `).join('');
}

// --- Main Save ---
async function saveAdminSettings() {
    const btn = document.querySelector('button[onclick="saveAdminSettings()"]');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    // Logo Upload logic
    let logoURL = document.getElementById('currentLogoURL').value;
    const logoFile = document.getElementById('logoUpload').files[0];
    if (logoFile) {
        try {
            const fd = new FormData(); fd.append('logo', logoFile);
            const res = await apiFetch('/api/upload-logo', { method: 'POST', body: fd });
            logoURL = res.url;
        } catch(e) { console.error("Logo upload failed", e); }
    }

    const settings = {
        schoolName: document.getElementById('schoolName').value,
        schoolTagline: document.getElementById('school-tagline').value,
        topHeaderPhone: document.getElementById('topHeaderPhone').value,
        topHeaderEmail: document.getElementById('topHeaderEmail').value,
        logoURL: logoURL,
        aboutUsText: aboutEditor ? aboutEditor.getData() : '',
        admission: admissionEditor ? admissionEditor.getData() : '',
        
        sectionVisibility: getVisibilityState(), // Now returns an Object, safe for server
       // ★ Add these two lines here to SAVE the colors ★
        themePrimary: document.getElementById('themePrimary').value,
        themeSecondary: document.getElementById('themeSecondary').value
    };

    try {
        await apiFetch('/api/settings', {
            method: 'POST',
            body: JSON.stringify({ settings })
        });
        alert('All settings saved successfully!');
        // Reload to show saved state
        await loadAdminData();
    } catch(e) {
        alert('Error saving settings.');
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="bi bi-save-fill me-2"></i>SAVE ALL CHANGES';
    }
}


// --- Helper: Sync Color Pickers with Text Inputs ---
document.addEventListener('DOMContentLoaded', () => {
    ['themePrimary', 'themeSecondary'].forEach(id => {
        const picker = document.getElementById(id);
        const text = document.getElementById(id + 'Text');
        
        if(picker && text) {
            // When color picker changes, update text box
            picker.addEventListener('input', () => {
                text.value = picker.value;
            });
            // When text box changes, update color picker
            text.addEventListener('input', () => {
                picker.value = text.value;
            });
        }
    });
});

function logoutAdmin() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}