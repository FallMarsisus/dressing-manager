import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
// Importation des modules d'authentification
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

// ==========================================================================
// 1. ÉTAT DE L'APPLICATION ET CONFIGURATION
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDCZAmiumiuKAuIPbpBJJ7Fvj1D9AxEFzE",
    authDomain: "radio-51a98.firebaseapp.com",
    projectId: "radio-51a98",
    storageBucket: "radio-51a98.firebasestorage.app",
    messagingSenderId: "494022550959",
    appId: "1:494022550959:web:56e62028504dfdb667bb5a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const structureCategories = {
    "Hauts": ["Hauts unicolores", "T-Shirts à dessin", "Tops de soirée", "Tops whimsy", "Sweats", "Pulls", "Chemises", "T-Shirt à manches longues"],
    "Bas": ["Jupes Longues", "Jupes Courtes", "Shorts", "Jeans", "Pantalons"],
    "Chaussures": ["Bottes", "Docs", "Sandales", "Baskets"],
    "Autre": ["Sport", "Manteaux", "Vestes"]
};

const iconesCategories = {
    "Hauts unicolores": "apparel", "T-Shirts à dessin": "draw_collage", "Tops de soirée": "nightlife", "Tops whimsy": "flare", 
    "Sweats": "apparel", "Pulls": "chair_fireplace", "Chemises": "dry_cleaning", "T-Shirt à manches longues": "apparel",
    "Jupes Longues": "arrow_cool_down", "Jupes Courtes": "arrow_drop_down", "Shorts": "wb_sunny", "Jeans": "grid_on", "Pantalons": "crop_portrait",
    "Bottes": "snowshoeing", "Docs": "footprint", "Sandales": "beach_access", "Baskets": "directions_run",
    "Sport": "fitness_center", "Manteaux": "ac_unit", "Vestes": "ac_unit"
};

const listeGommettes = ["Poubelle", "Favori", "A mettre", "Trop grand", "Trop petit", "Hiver", "Ete", "Mixte", "Punaise"];

// Variables d'état partagées globales
let datasetVetements = [];
let filtreActif = "Tous";
let familleFiltreActif = ""; 
let saisieRecherche = "";
let currentStep = 1; 
let parentChoisiFormulaire = "";
let prefillParentCategory = "";
let prefillSubCategory = "";
let currentUser = null; // Stocke l'utilisateur connecté
let unsubscribeVetements = null; // Permet de couper l'écouteur Firestore à la déconnexion

// Capture des références DOM
const themeBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const inlineFlowContainer = document.getElementById('sidebar-pills-target');
const sidebarGoms = document.getElementById('filter-gommettes-target');
const searchInput = document.getElementById('search-input');
const itemsCount = document.getElementById('items-count');
const listTarget = document.getElementById('list-target');
const btnToutVoir = document.getElementById('btn-tout-voir');

const modal = document.getElementById('modal-ajout');
const modalTitle = document.getElementById('modal-title');
const form = document.getElementById('form-ajout');
const stepIndicator = document.getElementById('step-indicator');
const btnRetour = document.getElementById('btn-etape-retour');
const btnSuivant = document.getElementById('btn-etape-suivant');
const btnSoumettre = document.getElementById('btn-soumettre');
const giantChoices = document.querySelectorAll('.btn-giant-choice');
const fSubs = document.getElementById('form-sub-categories');
const fGoms = document.getElementById('form-gommettes');
const photoInput = document.getElementById('photo-upload');
const fileNameDisplayModal = document.getElementById('file-name-display-modal');

// DOM Éléments d'Authentification
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userProfile = document.getElementById('user-profile');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const fabAdd = document.getElementById('fab-add');
const installBtn = document.getElementById('install-btn');
const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
const mobileSidebarToggleIcon = document.getElementById('mobile-sidebar-toggle-icon');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
let deferredPrompt = null;

function isMobileLayout() {
    return window.matchMedia('(max-width: 900px)').matches;
}

function setSidebarOpen(isOpen) {
    if (!isMobileLayout()) return;
    document.body.classList.toggle('sidebar-open', isOpen);
    mobileSidebarToggleIcon.innerText = isOpen ? 'close' : 'menu';
    mobileSidebarToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
}

function toggleSidebar() {
    setSidebarOpen(!document.body.classList.contains('sidebar-open'));
}

function closeSidebarOnMobile() {
    setSidebarOpen(false);
}

function syncSidebarStateToViewport() {
    if (!isMobileLayout()) {
        document.body.classList.remove('sidebar-open');
        mobileSidebarToggleIcon.innerText = 'menu';
        mobileSidebarToggle.setAttribute('aria-label', 'Ouvrir le menu');
    }
}

mobileSidebarToggle.addEventListener('click', toggleSidebar);
sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));
window.addEventListener('resize', syncSidebarStateToViewport);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSidebarOpen(false);
});

// ==========================================
// 2. GESTION DE L'AUTHENTIFICATION (NOUVEAU)
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // Mettre à jour l'interface utilisateur
        btnLogin.style.display = 'none';
        userProfile.style.display = 'flex';
        userPhoto.src = user.photoURL || "";
        userName.textContent = user.displayName || "Profil";
        fabAdd.style.display = 'flex';

        // Lancer l'écoute en temps réel de ses vêtements personnalisés
        ecouterDressingUtilisateur(user.uid);
    } else {
        currentUser = null;
        // Nettoyage de l'interface et déconnexion
        btnLogin.style.display = 'flex';
        userProfile.style.display = 'none';
        fabAdd.style.display = 'none';
        datasetVetements = [];
        filtrerEtAfficher();
        
        if (unsubscribeVetements) {
            unsubscribeVetements();
            unsubscribeVetements = null;
        }
        listTarget.innerHTML = '<p class="status-text">Veuillez vous connecter pour voir votre dressing.</p>';
        itemsCount.textContent = `0 pièce`;
    }
});

btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => console.error("Erreur de connexion:", err));
});

btnLogout.addEventListener('click', () => {
    signOut(auth).catch(err => console.error("Erreur de déconnexion:", err));
});

// Synchro BDD en temps réel isolée par utilisateur
function ecouterDressingUtilisateur(uid) {
    if (unsubscribeVetements) unsubscribeVetements();

    const pathCollection = collection(db, "users", uid, "vetements");
    const q = query(pathCollection, orderBy("CreatedAt", "desc"));

    unsubscribeVetements = onSnapshot(q, (snapshot) => {
        datasetVetements = [];
        snapshot.forEach(doc => { 
            const data = doc.data(); 
            if (data.dummy !== true) datasetVetements.push({ id: doc.id, ...data }); 
        });
        filtrerEtAfficher();
    }, (error) => {
        console.error("Erreur de lecture Firestore (vérifie tes règles de sécurité) :", error);
    });
}

// ==========================================
// 3. LOGIQUE DES ÉTAPES DU STEPPER FORMULAIRE
// ==========================================
function updateStepperUI() {
    document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
    const targetStepBlock = document.querySelector(`.form-step[data-step="${currentStep}"]`);
    if (targetStepBlock) targetStepBlock.classList.add('active');

    stepIndicator.textContent = `Étape ${currentStep}/3`;
    btnRetour.style.display = currentStep > 1 ? 'block' : 'none';
    
    if (currentStep === 1 || currentStep === 2) { 
        btnSuivant.style.display = 'none'; 
        btnSoumettre.style.display = 'none'; 
    } else if (currentStep === 3) { 
        btnSuivant.style.display = 'none'; 
        btnSoumettre.style.display = 'block'; 
    }
}

function trouverParentPourSousCategorie(sousCategorie) {
    return Object.keys(structureCategories).find(parent => structureCategories[parent].includes(sousCategorie)) || "";
}

function resetCreationFilterPrefill() {
    prefillParentCategory = "";
    prefillSubCategory = "";
}

function genererSousCategoriesEtape2(parent, valeurSelectionnee = "") {
    fSubs.innerHTML = "";
    if (structureCategories[parent]) {
        structureCategories[parent].forEach(child => {
            const isChecked = child === valeurSelectionnee ? "checked" : "";
            const nomIcone = iconesCategories[child] || "apparel";
            fSubs.innerHTML += `<label class="subcat-square-label"><input type="radio" name="cats" value="${child}" ${isChecked} required><span class="icon">${nomIcone}</span><span class="label">${child}</span></label>`;
        });
        fSubs.querySelectorAll('input[name="cats"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    currentStep = 3;
                    updateStepperUI();
                }
            });
        });
    }
}

giantChoices.forEach(btn => {
    btn.addEventListener('click', () => {
        giantChoices.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        parentChoisiFormulaire = btn.getAttribute('data-value');
        genererSousCategoriesEtape2(parentChoisiFormulaire);
        currentStep = 2; 
        updateStepperUI();
    });
});

btnSuivant.addEventListener('click', () => {
    if (currentStep === 2) {
        if (!document.querySelector('input[name="cats"]:checked')) { alert("Sélectionne un type."); return; }
        currentStep = 3; 
        updateStepperUI();
    }
});
btnRetour.addEventListener('click', () => { if (currentStep > 1) { currentStep--; updateStepperUI(); } });

// ==========================================
// 4. GENERATION DE L'INTERFACE (SIDEBAR)
// ==========================================
function genererPillsSidebar() {
    inlineFlowContainer.innerHTML = "";
    Object.keys(structureCategories).forEach(parent => {
        const pBtn = document.createElement('button');
        pBtn.className = 'chip parent-pill-btn';
        pBtn.setAttribute('data-parent', parent);
        pBtn.innerHTML = `<span class="dot cat"></span> ${parent}`;
        inlineFlowContainer.appendChild(pBtn);
    });
    sidebarGoms.innerHTML = "";
    listeGommettes.forEach(g => sidebarGoms.innerHTML += `<button class="chip" data-filter="${g}"><span class="dot gom"></span> ${g}</button>`);
}
genererPillsSidebar();

fGoms.innerHTML = "";
listeGommettes.forEach(g => fGoms.innerHTML += `<label class="form-chip-label"><input type="checkbox" name="goms" value="${g}"> ${g}</label>`);

// ==========================================
// 5. MOTEUR DE FILTRAGE ET FILTERS LISTENERS
// ==========================================
inlineFlowContainer.addEventListener('click', (e) => {
    const parentBtn = e.target.closest('.parent-pill-btn');
    if (!parentBtn) return;

    const parentName = parentBtn.getAttribute('data-parent');
    const subPillsExistantes = document.querySelectorAll('.sidebar-sub-pills');

    if (parentBtn.classList.contains('active')) {
        parentBtn.classList.remove('active');
        subPillsExistantes.forEach(el => el.remove());
        btnToutVoir.classList.add('active');
        filtreActif = "Tous"; familleFiltreActif = "";
        resetCreationFilterPrefill();
        filtrerEtAfficher();
        closeSidebarOnMobile();
        return;
    }

    subPillsExistantes.forEach(el => el.remove());
    document.querySelectorAll('.sidebar .chip, #btn-tout-voir').forEach(b => b.classList.remove('active'));

    parentBtn.classList.add('active');
    filtreActif = "Famille"; familleFiltreActif = parentName;
    prefillParentCategory = parentName;
    prefillSubCategory = "";

    let elementPrecedent = parentBtn;
    structureCategories[parentName].forEach(child => {
        const cBtn = document.createElement('button');
        cBtn.className = 'chip sidebar-sub-pills sidebar-child-trigger';
        cBtn.setAttribute('data-filter', child);
        cBtn.innerText = child;
        elementPrecedent.after(cBtn);
        elementPrecedent = cBtn;
    });
    filtrerEtAfficher();
    closeSidebarOnMobile();
});

document.addEventListener('click', (e) => {
    const globalBtn = e.target.closest('#btn-tout-voir');
    const childTrigger = e.target.closest('.sidebar-child-trigger');
    const gommetteTrigger = e.target.closest('#filter-gommettes-target .chip');

    if (globalBtn) {
        document.querySelectorAll('.sidebar-sub-pills').forEach(el => el.remove());
        document.querySelectorAll('.sidebar .chip').forEach(b => b.classList.remove('active'));
        globalBtn.classList.add('active');
        filtreActif = "Tous"; familleFiltreActif = "";
        resetCreationFilterPrefill();
        filtrerEtAfficher();
        closeSidebarOnMobile();
    }
    if (childTrigger) {
        document.querySelectorAll('.sidebar-child-trigger').forEach(b => b.classList.remove('active'));
        childTrigger.classList.add('active');
        filtreActif = childTrigger.getAttribute('data-filter');
        const parentForChild = trouverParentPourSousCategorie(filtreActif);
        prefillParentCategory = parentForChild;
        prefillSubCategory = filtreActif;
        filtrerEtAfficher();
        closeSidebarOnMobile();
    }
    if (gommetteTrigger) {
        document.querySelectorAll('.sidebar .chip, #btn-tout-voir').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-sub-pills').forEach(el => el.remove());
        gommetteTrigger.classList.add('active');
        filtreActif = gommetteTrigger.getAttribute('data-filter');
        familleFiltreActif = "";
        resetCreationFilterPrefill();
        filtrerEtAfficher();
        closeSidebarOnMobile();
    }
});

// ==========================================
// 6. ENREGISTREMENTS, COMPRESSION & ACTIONS CRUD
// ==========================================
function compresserVersBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h && w > 800) { h *= 800 / w; w = 800; } else if (h > 800) { w *= 800 / h; h = 800; }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

function creerCarteAjoutDansListe() {
    const addCard = document.createElement('div');
    addCard.className = 'carte-vetement add-card';
    addCard.innerHTML = `
        <div class="add-card-body">
            <span class="icon">add</span>
        </div>
    `;
    addCard.addEventListener('click', () => fabAdd.click());
    return addCard;
}

function filtrerEtAfficher() {
    listTarget.innerHTML = "";
    if (!currentUser) {
        listTarget.innerHTML = '<p class="status-text">Veuillez vous connecter pour voir votre dressing.</p>';
        return;
    }

    const resultat = datasetVetements.filter(v => {
        const matchTexte = v.nom.toLowerCase().includes(saisieRecherche.toLowerCase());
        let matchBouton = false;
        if (filtreActif === "Tous") { matchBouton = true; } 
        else if (filtreActif === "Famille") { const sousCat = v.catégorie ? v.catégorie[0] : ""; matchBouton = structureCategories[familleFiltreActif]?.includes(sousCat); } 
        else { matchBouton = (v.catégorie && v.catégorie.includes(filtreActif)) || (v.saison && v.saison.includes(filtreActif)); }
        return matchTexte && matchBouton;
    });
    itemsCount.textContent = `${resultat.length} pièce${resultat.length > 1 ? 's' : ''}`;

    if (resultat.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'status-text';
        emptyMessage.textContent = 'Aucun élément.';
        listTarget.appendChild(emptyMessage);
        listTarget.appendChild(creerCarteAjoutDansListe());
        return;
    }
    resultat.forEach(v => {
        let badgesHTML = "";
        if (v.catégorie) v.catégorie.forEach(c => badgesHTML += `<span class="chip"><span class="dot cat"></span>${c}</span>`);
        if (v.saison) v.saison.forEach(g => badgesHTML += `<span class="chip"><span class="dot gom"></span>${g}</span>`);
        let sourceImg = v.ImageURL || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=500&auto=format&fit=crop";

        const carte = document.createElement('div'); carte.className = 'carte-vetement';
        carte.innerHTML = `
            <div class="img-container"><img src="${sourceImg}" alt="${v.nom}" loading="lazy"><div class="action-overlay"><button class="btn-action edit-btn"><span class="icon">edit</span></button><button class="btn-action delete delete-btn"><span class="icon">delete</span></button></div></div>
            <div class="product-info"><div class="nom">${v.nom || 'Sans nom'}</div><div class="badge-row">${badgesHTML}</div></div>
        `;
        carte.querySelector('.edit-btn').addEventListener('click', () => chargerDonneesDansModale(v));
        carte.querySelector('.delete-btn').addEventListener('click', () => supprimerVetement(v.id));
        listTarget.appendChild(carte);
    });
    listTarget.appendChild(creerCarteAjoutDansListe());
}

searchInput.addEventListener('input', (e) => { saisieRecherche = e.target.value; filtrerEtAfficher(); });

// Déclenchement de la modale d'ajout
fabAdd.addEventListener('click', () => {
    closeSidebarOnMobile();
    modalTitle.textContent = "Nouvelle Pièce"; document.getElementById('edit-id').value = "";
    form.reset(); giantChoices.forEach(b => b.classList.remove('selected'));
    parentChoisiFormulaire = "";
    fileNameDisplayModal.textContent = "Prendre ou choisir une image";

    if (prefillSubCategory) {
        const parent = trouverParentPourSousCategorie(prefillSubCategory);
        parentChoisiFormulaire = parent;
        giantChoices.forEach(b => { if (b.getAttribute('data-value') === parent) b.classList.add('selected'); });
        genererSousCategoriesEtape2(parent, prefillSubCategory);
        currentStep = 3;
    } else if (prefillParentCategory) {
        parentChoisiFormulaire = prefillParentCategory;
        giantChoices.forEach(b => { if (b.getAttribute('data-value') === prefillParentCategory) b.classList.add('selected'); });
        genererSousCategoriesEtape2(prefillParentCategory);
        currentStep = 2;
    } else {
        currentStep = 1;
    }

    updateStepperUI();
    modal.style.display = 'flex';
});

document.getElementById('btn-annuler').addEventListener('click', () => { modal.style.display = 'none'; form.reset(); });
modal.addEventListener('click', (e) => { if(e.target === modal) modal.style.display = 'none'; });
photoInput.addEventListener('change', (e) => { if (e.target.files[0]) fileNameDisplayModal.textContent = e.target.files[0].name; });

function chargerDonneesDansModale(vetement) {
    closeSidebarOnMobile();
    modalTitle.textContent = "Éditer la pièce"; form.reset();
    document.getElementById('edit-id').value = vetement.id;
    document.getElementById('nom').value = vetement.nom || ""; 

    let parentTrouve = "";
    const sousCatEnregistree = vetement.catégorie ? vetement.catégorie[0] : "";
    Object.keys(structureCategories).forEach(parent => { if (structureCategories[parent].includes(sousCatEnregistree)) parentTrouve = parent; });

    giantChoices.forEach(b => b.classList.remove('selected'));
    if (parentTrouve) {
        giantChoices.forEach(b => { if(b.getAttribute('data-value') === parentTrouve) b.classList.add('selected'); });
        genererSousCategoriesEtape2(parentTrouve, sousCatEnregistree);
    }
    document.querySelectorAll('input[name="goms"]').forEach(el => el.checked = vetement.saison?.includes(el.value));
    fileNameDisplayModal.textContent = vetement.ImageURL ? "Image enregistrée (clique pour remplacer)" : "Prendre ou choisir une image";
    
    currentStep = 1; 
    updateStepperUI(); 
    modal.style.display = 'flex';
}

async function supprimerVetement(id) { 
    if (!currentUser) return;
    if (confirm("Supprimer cette pièce ?")) { 
        await deleteDoc(doc(db, "users", currentUser.uid, "vetements", id)); 
    } 
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const btnSubmit = document.getElementById('btn-soumettre');
    const idEdition = document.getElementById('edit-id').value;
    btnSubmit.disabled = true;

    try {
        const file = photoInput.files[0];
        let base64Data = ""; if (file) base64Data = await compresserVersBase64(file);
        const sousCatChoisie = document.querySelector('input[name="cats"]:checked')?.value;

        const payload = {
            nom: document.getElementById('nom').value,
            catégorie: sousCatChoisie ? [sousCatChoisie] : [],
            saison: Array.from(document.querySelectorAll('input[name="goms"]:checked')).map(el => el.value)
        };
        if (file) payload.ImageURL = base64Data;

        const userVetementsRef = collection(db, "users", currentUser.uid, "vetements");

        if (idEdition) { 
            await updateDoc(doc(db, "users", currentUser.uid, "vetements", idEdition), payload); 
        } else { 
            payload.ImageURL = base64Data || ""; 
            payload.CreatedAt = new Date(); 
            payload.dummy = false; 
            await addDoc(userVetementsRef, payload); 
        }
        form.reset(); modal.style.display = 'none';
    } catch (err) { 
        console.error("Erreur lors de l'enregistrement:", err); 
    } finally { 
        btnSubmit.disabled = false; 
    }
});

// Installation PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
        installBtn.style.display = 'none';
        deferredPrompt = null;
    }
});

window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    deferredPrompt = null;
    console.log('Dressing Virtuel installé');
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service worker enregistré'))
            .catch((err) => console.error('Erreur enregistrement SW:', err));
    });
}

// Toggle Thème Clair/Sombre
themeBtn.addEventListener('click', () => {
    if (document.body.getAttribute('data-theme') === 'dark') { document.body.removeAttribute('data-theme'); themeIcon.innerText = 'dark_mode'; } 
    else { document.body.setAttribute('data-theme', 'dark'); themeIcon.innerText = 'light_mode'; }
});