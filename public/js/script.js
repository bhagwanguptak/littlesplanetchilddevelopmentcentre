document.addEventListener("DOMContentLoaded", async () => {
    const API_BASE = ''; 

    try {
        const [settingsRes, servicesRes, testRes, carouselRes] = await Promise.all([
            fetch(`${API_BASE}/api/settings`),
            fetch(`${API_BASE}/api/services`),
            fetch(`${API_BASE}/api/testimonials`),
            fetch(`${API_BASE}/api/carousel`)
        ]);

        const settings = await settingsRes.json();
        const services = await servicesRes.json().catch(()=>[]);
        const testimonials = await testRes.json().catch(()=>[]);
        const slides = await carouselRes.json().catch(()=>[]);
        
        const safeServices = Array.isArray(services) ? services : [];
        const safeTestimonials = Array.isArray(testimonials) ? testimonials : [];
        const safeSlides = Array.isArray(slides) ? slides : [];

        // --- 1. DYNAMIC THEME COLORS ---
        if (settings.themePrimary) {
            document.documentElement.style.setProperty('--primary-color', settings.themePrimary);
        }
        if (settings.themeSecondary) {
            document.documentElement.style.setProperty('--secondary-color', settings.themeSecondary);
        }

        // --- 2. Visibility ---
        let visibility = { hero: true, about: true, services: true, admissions: true, testimonials: true, contact: true };
        if(settings.sectionVisibility) {
            let visData = settings.sectionVisibility;
            if (typeof visData === 'string') {
                try { visData = JSON.parse(visData); } catch(e) {}
            }
            visibility = { ...visibility, ...visData };
        }

        const sections = ['hero', 'about', 'services', 'admissions', 'testimonials', 'contact'];
        const navList = document.getElementById('dynamicNav');

        sections.forEach(secId => {
            const el = document.getElementById(`${secId}-section`);
            if (visibility[secId] === false) {
                if(el) el.classList.add('d-none');
            } else {
                if(el) el.classList.remove('d-none');
                if(navList) {
                    const displayName = secId.charAt(0).toUpperCase() + secId.slice(1);
                    navList.innerHTML += `<li class="nav-item"><a class="nav-link" href="#${secId}-section">${displayName}</a></li>`;
                }
            }
        });

        // --- 3. Content ---
        setText('navSchoolName', settings.schoolName);
        setText('footerName', settings.schoolName);
        setText('yearSpan', new Date().getFullYear());
        
        setText('topPhoneDisplay', settings.topHeaderPhone);
        if(document.getElementById('topPhoneLink')) document.getElementById('topPhoneLink').href = `tel:${settings.topHeaderPhone}`;
        
        setText('topEmailDisplay', settings.topHeaderEmail);
        if(document.getElementById('topEmailLink')) document.getElementById('topEmailLink').href = `mailto:${settings.topHeaderEmail}`;

        setText('contactPhoneDisplay', settings.topHeaderPhone);
        setText('contactEmailDisplay', settings.topHeaderEmail);

        if (settings.logoURL) {
            ['navLogo', 'footerLogo'].forEach(id => {
                const el = document.getElementById(id);
                if(el) { el.src = settings.logoURL; el.classList.remove('d-none'); }
            });
            const fav = document.getElementById('dynamicFavicon');
            if(fav) fav.href = settings.logoURL;
        }
        
        setHTML('aboutContent', settings.aboutUsText);
        setHTML('admissionsContent', settings.admission);
        if(document.getElementById('aboutImg')) document.getElementById('aboutImg').src = settings.aboutUsImageURL || 'https://via.placeholder.com/600';

        // --- 4. Render Lists ---
        const sGrid = document.getElementById('servicesGrid');
        if (safeServices.length > 0) {
            sGrid.innerHTML = safeServices.map(s => `
                <div class="col-md-6 col-lg-4">
                    <div class="service-card text-center h-100">
                        <div class="icon-box">
                            ${s.image_url ? `<img src="${s.image_url}">` : `<i class="bi ${s.icon_class || 'bi-star'}"></i>`}
                        </div>
                        <h4>${s.title}</h4>
                        <p class="text-muted small mt-3">${s.description}</p>
                    </div>
                </div>`).join('');
        } else {
            sGrid.innerHTML = '<div class="col-12 text-center text-muted">No services added.</div>';
        }

        const tGrid = document.getElementById('testimonialsGrid');
        if (safeTestimonials.length > 0) {
            tGrid.innerHTML = safeTestimonials.map(t => `
                <div class="col-md-4">
                    <div class="testimonial-card shadow-sm h-100 p-4 bg-white text-dark rounded-4">
                        <div class="mb-3 text-warning"><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i></div>
                        <p class="fst-italic">"${t.message}"</p>
                        <h6 class="mt-4 fw-bold text-primary mb-0">${t.name}</h6>
                        <small class="text-muted">${t.role || 'Parent'}</small>
                    </div>
                </div>`).join('');
        } else {
            tGrid.innerHTML = '<div class="col-12 text-center text-white">No reviews yet.</div>';
        }

        const hInner = document.getElementById('heroInner');
        const hInd = document.getElementById('heroIndicators');
        if (visibility['hero'] !== false) {
            if (safeSlides.length > 0) {
                hInner.innerHTML = safeSlides.map((s, i) => `
                    <div class="carousel-item ${i===0?'active':''}">
                        <img src="${s.image_url}" class="d-block w-100" alt="Slide">
                        <div class="carousel-caption d-none d-md-block">
                            <h2 class="display-4 fw-bold">${settings.schoolName}</h2>
                            <p class="lead fw-bold">${settings.schoolTagline || ''}</p>
                        </div>
                    </div>`).join('');
                hInd.innerHTML = safeSlides.map((_, i) => `<button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="${i}" class="${i===0?'active':''}" aria-label="Slide ${i+1}"></button>`).join('');
            } else {
                hInner.innerHTML = `<div class="carousel-item active"><div class="d-block w-100 bg-secondary d-flex align-items-center justify-content-center text-white" style="height:600px;"><h3>${settings.schoolName}</h3></div></div>`;
            }
        }

        // --- 5. WhatsApp Integration (Floating Button) ---
        // Checks 'adminSchoolWhatsappNumber' first, falls back to 'socialWhatsapp'
        const waNumber = settings.adminSchoolWhatsappNumber || settings.socialWhatsapp;
        if (waNumber) {
            const waBtn = document.getElementById('whatsappFab');
            if (waBtn) {
                waBtn.href = `https://wa.me/${waNumber}`;
                waBtn.style.display = 'flex'; // Show the button
            }
        }

        // --- 6. Contact Form Handling ---
        const contactForm = document.getElementById('mainContactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                // Get form values
                const name = this.querySelector('input[name="contactName"]').value;
                const msg = this.querySelector('textarea[name="contactMessage"]').value;
                const statusDiv = document.getElementById('contactStatus');
                
                // If we have a number, direct WhatsApp redirect is faster/reliable
                if (waNumber) {
                    statusDiv.innerHTML = '<span class="text-success">Redirecting to WhatsApp...</span>';
                    const text = `Hello, my name is ${name}. ${msg}`;
                    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
                    
                    setTimeout(() => {
                        window.open(url, '_blank');
                        this.reset();
                        statusDiv.innerHTML = '';
                    }, 1000);
                } else {
                    // Fallback: Just show a message if no number configured
                    statusDiv.innerHTML = '<span class="text-info">Thank you! We will contact you soon.</span>';
                }
            });
        }

    } catch (e) { console.error("Script Error:", e); } 
    finally { const loader = document.getElementById('page-loader'); if(loader) loader.style.display = 'none'; }
});

function setText(id, val) { const el = document.getElementById(id); if(el) el.innerText = val || ''; }
function setHTML(id, val) { const el = document.getElementById(id); if(el) el.innerHTML = val || ''; }