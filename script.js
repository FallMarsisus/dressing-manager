import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
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
    "Autre": ["Sport", "Manteaux", "Vestes", "Sacs"]
};

const iconesCategories = {
    "Hauts unicolores": "apparel", "T-Shirts à dessin": "draw_collage", "Tops de soirée": "nightlife", "Tops whimsy": "flare", 
    "Sweats": "apparel", "Pulls": "chair_fireplace", "Chemises": "dry_cleaning", "T-Shirt à manches longues": "apparel",
    "Jupes Longues": "arrow_cool_down", "Jupes Courtes": "arrow_drop_down", "Shorts": "wb_sunny", "Jeans": "grid_on", "Pantalons": "crop_portrait",
    "Bottes": "snowshoeing", "Docs": "footprint", "Sandales": "beach_access", "Baskets": "directions_run",
    "Sport": "fitness_center", "Manteaux": "ac_unit", "Vestes": "ac_unit", "Sacs": "shopping_bag"
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
// 2. GESTION DE L'AUTHENTIFICATION & CHARGEMENT
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        btnLogin.style.display = 'none';
        userProfile.style.display = 'flex';
        userPhoto.src = user.photoURL || "";
        userName.textContent = user.displayName || "Profil";
        
        if(navDressing.classList.contains('active-global')) {
            fabAdd.style.display = 'flex';
        }

        ecouterDressingUtilisateur(user.uid);
        
        // NOUVEAU : On charge la collection "tenues" lors de la connexion
        await chargerTenuesFirebase(user.uid);
    } else {
        currentUser = null;
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

        // Réinitialisation locale des tenues
        outfitsData = {};
        const defaultId = "local_default";
        outfitsData[defaultId] = { name: "Tenue du jour", items: [] };
        currentOutfitId = defaultId;
        if(outfitNameInput) outfitNameInput.value = outfitsData[currentOutfitId].name;
        renderOutfitSelector();
        if(navOutfit.classList.contains('active-global')) chargerTenueDuStock(currentOutfitId);
    }
});

btnLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => console.error("Erreur de connexion:", err));
});

btnLogout.addEventListener('click', () => {
    signOut(auth).catch(err => console.error("Erreur de déconnexion:", err));
});

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
        if(navOutfit.classList.contains('active-global')) genererGardeRobeCreateur();
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
                const ctx = canvas.getContext('2d'); 
                
                // On dessine l'image en conservant sa couche alpha (transparence)
                ctx.drawImage(img, 0, 0, w, h);
                
                // NOUVEAU : On utilise 'image/webp' au lieu de jpeg. 
                // Ça gère la transparence et compresse super bien !
                resolve(canvas.toDataURL('image/webp', 0.85));
            };
        };
    });
}

function creerCarteAjoutDansListe() {
    const addCard = document.createElement('div');
    addCard.className = 'carte-vetement add-card';
    addCard.innerHTML = `<div class="add-card-body"><span class="icon">add</span></div>`;
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

themeBtn.addEventListener('click', () => {
    if (document.body.getAttribute('data-theme') === 'dark') { document.body.removeAttribute('data-theme'); themeIcon.innerText = 'dark_mode'; } 
    else { document.body.setAttribute('data-theme', 'dark'); themeIcon.innerText = 'light_mode'; }
});

// ==========================================================================
// 7. CRÉATEUR DE TENUES & SAUVEGARDE FIREBASE
// ==========================================================================
const navDressing = document.getElementById('nav-dressing');
const navOutfit = document.getElementById('nav-outfit');
const viewDressing = document.getElementById('view-dressing');
const viewOutfit = document.getElementById('view-outfit');
const outfitCanvas = document.getElementById('outfit-canvas');
const canvasHint = document.getElementById('canvas-hint');
const dressingFilters = document.getElementById('dressing-filters');
const outfitSidebarTools = document.getElementById('outfit-sidebar-tools');

// Références du nouveau header d'édition
const outfitNameInput = document.getElementById('outfit-name-input');
const btnSaveOutfit = document.getElementById('btn-save-outfit');

// Moteur local des tenues
let outfitsData = {};
let currentOutfitId = null;
let activeCanvasItem = null;
let outfitDirty = false; // Flag pour tracer les modifications non sauvegardées

// Fonction pour mettre à jour l'état du bouton Save
function updateSaveButtonState() {
    if (outfitDirty) {
        btnSaveOutfit?.classList.add('unsaved');
    } else {
        btnSaveOutfit?.classList.remove('unsaved');
    }
}

// Chargement initial des tenues depuis Firebase
async function chargerTenuesFirebase(uid) {
    try {
        const tenuesSnapshot = await getDocs(collection(db, "users", uid, "tenues"));
        let aCharge = false;
        outfitsData = {};
        
        tenuesSnapshot.forEach(doc => {
            outfitsData[doc.id] = doc.data();
            aCharge = true;
        });
        
        // S'il n'y a encore aucune tenue dans Firebase, on en prépare une vide
        if (!aCharge) {
            const defaultId = "local_" + Date.now();
            outfitsData[defaultId] = { name: "Ma première tenue", items: [] };
            currentOutfitId = defaultId;
        } else {
            // Sinon on sélectionne la première par défaut
            currentOutfitId = Object.keys(outfitsData)[0];
        }
        
        if (outfitNameInput) outfitNameInput.value = outfitsData[currentOutfitId].name;
        renderOutfitSelector();
        
        if(navOutfit.classList.contains('active-global')) {
            chargerTenueDuStock(currentOutfitId);
        }
    } catch(err) {
        console.error("Erreur chargement tenues Firebase :", err);
    }
}

// Synchronisation de l'input vers les données locales
if(outfitNameInput) {
    outfitNameInput.addEventListener('input', (e) => {
        if(currentOutfitId && outfitsData[currentOutfitId]) {
            outfitsData[currentOutfitId].name = e.target.value || "Nouvelle Tenue";
            outfitDirty = true;
            updateSaveButtonState();
            renderOutfitSelector();
        }
    });
}

// Warning avant de quitter la page si des modifications non sauvegardées
window.addEventListener('beforeunload', (e) => {
    if (outfitDirty && navOutfit.classList.contains('active-global')) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

// Action du nouveau bouton Sauvegarder
if(btnSaveOutfit) {
    btnSaveOutfit.addEventListener('click', async () => {
        if(!currentUser) {
            alert("Connecte-toi pour sauvegarder tes tenues.");
            return;
        }

        // On s'assure d'avoir la dernière position des éléments du canevas
        sauvegarderTenueActuelle(); 
        
        const originalText = btnSaveOutfit.innerHTML;
        btnSaveOutfit.innerHTML = `<span class="icon">hourglass_empty</span>...`;
        btnSaveOutfit.disabled = true;
        
        try {
            const payload = outfitsData[currentOutfitId];
            
            // setDoc remplace/crée le document, idéal pour ce comportement
            await setDoc(doc(db, "users", currentUser.uid, "tenues", currentOutfitId), payload);
            
            outfitDirty = false; // Réinitialiser le flag après sauvegarde
            updateSaveButtonState();
            
            // Retour visuel de succès
            btnSaveOutfit.innerHTML = `<span class="icon">check</span> Enregistré`;
            btnSaveOutfit.style.background = "#388e3c"; 
            
            setTimeout(() => {
                btnSaveOutfit.innerHTML = `<span class="icon">save</span> Sauvegarder`;
                btnSaveOutfit.style.background = "var(--md-primary)";
                btnSaveOutfit.disabled = false;
            }, 2000);
            
        } catch (err) {
            console.error("Erreur lors de la sauvegarde de la tenue :", err);
            alert("Erreur de sauvegarde.");
            btnSaveOutfit.innerHTML = originalText;
            btnSaveOutfit.disabled = false;
        }
    });
}

// Écouteurs de navigation
navDressing.addEventListener('click', () => {
    sauvegarderTenueActuelle();
    navDressing.classList.add('active-global');
    navOutfit.classList.remove('active-global');
    viewDressing.classList.add('active');
    viewOutfit.classList.remove('active');
    
    dressingFilters.style.display = 'flex';
    outfitSidebarTools.style.display = 'none';
    fabAdd.style.display = currentUser ? 'flex' : 'none';
    
    if (isMobileLayout()) closeSidebarOnMobile();
});

navOutfit.addEventListener('click', () => {
    navOutfit.classList.add('active-global');
    navDressing.classList.remove('active-global');
    viewOutfit.classList.add('active');
    viewDressing.classList.remove('active');
    
    dressingFilters.style.display = 'none';
    outfitSidebarTools.style.display = 'flex';
    fabAdd.style.display = 'none';

    genererGardeRobeCreateur();
    if (isMobileLayout()) closeSidebarOnMobile();
});

function initialiserLogiqueArchitectureOutfits() {
    const drawers = document.querySelectorAll('.horizontal-drawer');
    const btnAddOutfit = document.getElementById('btn-add-outfit-placeholder');

    drawers.forEach(drawer => {
        const handle = drawer.querySelector('.drawer-handle');
        if (handle.dataset.listenerAttached) return;

        handle.addEventListener('click', () => {
            const isCollapsed = drawer.classList.contains('collapsed');
            drawers.forEach(d => d.classList.add('collapsed'));
            if (isCollapsed) drawer.classList.remove('collapsed');
            else drawer.classList.add('collapsed');
        });
        handle.dataset.listenerAttached = "true";
    });

    if (!outfitCanvas.dataset.dragListenersAttached) {
        outfitCanvas.addEventListener('dragover', (e) => { e.preventDefault(); outfitCanvas.classList.add('drag-over'); });
        outfitCanvas.addEventListener('dragleave', () => { outfitCanvas.classList.remove('drag-over'); });
        outfitCanvas.addEventListener('drop', (e) => {
            e.preventDefault(); outfitCanvas.classList.remove('drag-over'); canvasHint.style.display = 'none';
            const src = e.dataTransfer.getData('text/plain');
            if (!src) return;
            const rect = outfitCanvas.getBoundingClientRect();
            ajouterElementSurCanvas(src, e.clientX - rect.left, e.clientY - rect.top);
            outfitDirty = true;
            updateSaveButtonState();
            sauvegarderTenueActuelle();
        });
        outfitCanvas.dataset.dragListenersAttached = "true";
    }

    if (btnAddOutfit && !btnAddOutfit.dataset.listenerAttached) {
        btnAddOutfit.addEventListener('click', () => {
            sauvegarderTenueActuelle();
            
            // Création avec un ID local temporaire
            const newId = "local_" + Date.now();
            outfitsData[newId] = { name: `Nouvelle Tenue`, items: [] };
            
            renderOutfitSelector();
            switchOutfit(newId);
            
            if(outfitNameInput) {
                outfitNameInput.focus();
                outfitNameInput.select();
            }
        });
        btnAddOutfit.dataset.listenerAttached = "true";
    }
}

function renderOutfitSelector() {
    const listContainer = document.getElementById('outfit-selector-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    Object.keys(outfitsData).forEach(id => {
        const outfit = outfitsData[id];
        const btn = document.createElement('button');
        btn.className = `outfit-tab ${id === currentOutfitId ? 'active' : ''}`;
        btn.innerHTML = `<span class="icon">style</span><span class="label">${outfit.name}</span>`;
        btn.addEventListener('click', () => switchOutfit(id));
        listContainer.appendChild(btn);
    });
}

function switchOutfit(id) {
    sauvegarderTenueActuelle();
    currentOutfitId = id;
    if(outfitNameInput) outfitNameInput.value = outfitsData[id].name;
    renderOutfitSelector();
    chargerTenueDuStock(id);
}
// =======================================================
// Mise à jour : Architecture par ID & Noms discrets
// =======================================================

function sauvegarderTenueActuelle() {
    if (!currentOutfitId || !outfitsData[currentOutfitId]) return;
    const items = [];
    document.querySelectorAll('#outfit-canvas .canvas-item').forEach(el => {
        items.push({
            id: el.dataset.id, // On sauvegarde UNIQUEMENT l'ID
            left: el.style.left,
            top: el.style.top,
            width: el.style.width,
            height: el.style.height,
            rotation: el.dataset.rotation || 0,
            zIndex: parseInt(el.style.zIndex) || parseInt(window.getComputedStyle(el).zIndex) || 0
        });
    });
    outfitsData[currentOutfitId].items = items;
}

function chargerTenueDuStock(idOutfit) {
    document.querySelectorAll('#outfit-canvas .canvas-item').forEach(el => el.remove());
    const outfit = outfitsData[idOutfit];
    if (!outfit) return;

    if (outfit.items.length > 0) {
        canvasHint.style.display = 'none';
        outfit.items.forEach(item => {
            const vetement = datasetVetements.find(v => v.id === item.id);
            const src = vetement ? vetement.ImageURL : item.src; 
            
            // On récupère le nom depuis la base de données
            const nomItem = vetement ? (vetement.nom || "Sans nom") : "Pièce introuvable"; 
            
            if (!src) return; 

            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-item';
            wrapper.dataset.id = item.id || "legacy";
            wrapper.style.left = item.left;
            wrapper.style.top = item.top;
            wrapper.style.width = item.width;
            wrapper.style.height = item.height;
            wrapper.dataset.rotation = item.rotation || 0;
            wrapper.style.transform = `rotate(${item.rotation || 0}deg)`;
            // Restaurer l'ordre z-index si présent
            if (typeof item.zIndex !== 'undefined') {
                wrapper.style.zIndex = item.zIndex;
            }
            
            // Ajout du <div class="canvas-item-name">
            wrapper.innerHTML = `
                <img src="${src}">
                <div class="canvas-item-name">${nomItem}</div>
                <div class="delete-handle"><span class="icon">close</span></div>
                <div class="resize-handle"><span class="icon">open_in_full</span></div>
                <div class="rotate-handle"><span class="icon">refresh</span></div>
            `;
            outfitCanvas.appendChild(wrapper);
            rendreInteractif(wrapper);
        });
    } else {
        canvasHint.style.display = 'block';
    }
}

function genererGardeRobeCreateur() {
    initialiserLogiqueArchitectureOutfits();
    if (Object.keys(outfitsData).length > 0) {
        renderOutfitSelector();
        chargerTenueDuStock(currentOutfitId);
    }

    const tiroirsTargets = {
        "Hauts": document.getElementById('list-outfit-hauts'),
        "Bas": document.getElementById('list-outfit-bas'),
        "Chaussures": document.getElementById('list-outfit-chaussures'),
        "Autre": document.getElementById('list-outfit-autre')
    };
    
    Object.values(tiroirsTargets).forEach(t => { if (t) t.innerHTML = ''; });
    if (datasetVetements.length === 0) return;
    
    datasetVetements.forEach(v => {
        const sourceImg = v.ImageURL || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=500&auto=format&fit=crop";
        
        // Création du Wrapper (Image + Nom)
        const wrapper = document.createElement('div');
        wrapper.className = 'outfit-item-wrapper';
        wrapper.draggable = true; // C'est le conteneur entier qui se glisse
        
        wrapper.innerHTML = `
            <img src="${sourceImg}" class="outfit-item-source" draggable="false">
            <div class="outfit-item-name" title="${v.nom || 'Sans nom'}">${v.nom || 'Sans nom'}</div>
        `;
        
        wrapper.addEventListener('dragstart', (e) => {
            // ON TRANSMET L'ID DANS LE DRAG AU LIEU DE L'URL
            e.dataTransfer.setData('text/plain', v.id);
            e.dataTransfer.effectAllowed = "move";
            const parentDrawer = wrapper.closest('.horizontal-drawer');
            if (parentDrawer) setTimeout(() => parentDrawer.classList.add('collapsed'), 50);
        });
        
        wrapper.addEventListener('click', () => {
            canvasHint.style.display = 'none';
            const rect = outfitCanvas.getBoundingClientRect();
            ajouterElementSurCanvas(v.id, rect.width / 2, rect.height / 2); // Ajout par ID
            outfitDirty = true;
            updateSaveButtonState();
            sauvegarderTenueActuelle();
        });
        
        const subCat = v.catégorie && v.catégorie.length > 0 ? v.catégorie[0] : "";
        let parentCat = trouverParentPourSousCategorie(subCat);
        if (!parentCat || !tiroirsTargets[parentCat]) parentCat = "Autre";
        
        tiroirsTargets[parentCat].appendChild(wrapper);
    });
}

function ajouterElementSurCanvas(idVetement, centerX, centerY) {
    const vetement = datasetVetements.find(item => item.id === idVetement);
    let src = "";
    let finalId = idVetement;
    let nomItem = "Sans nom";
    
    if (vetement) {
        src = vetement.ImageURL || "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=500&auto=format&fit=crop";
        nomItem = vetement.nom || "Sans nom"; // Extraction du nom
    } else if (idVetement.startsWith('http') || idVetement.startsWith('data:image')) {
        src = idVetement;
        finalId = "legacy";
    } else {
        return; 
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-item';
    const size = 130;
    wrapper.style.left = `${centerX - size/2}px`;
    wrapper.style.top = `${centerY - size/2}px`;
    wrapper.style.width = `${size}px`;
    wrapper.style.height = `${size}px`;
    wrapper.dataset.rotation = 0;
    wrapper.dataset.id = finalId; 
    
    // Ajout du <div class="canvas-item-name">
    wrapper.innerHTML = `
        <img src="${src}">
        <div class="canvas-item-name">${nomItem}</div>
        <div class="delete-handle"><span class="icon">close</span></div>
        <div class="resize-handle"><span class="icon">open_in_full</span></div>
        <div class="rotate-handle"><span class="icon">refresh</span></div>
    `;
    outfitCanvas.appendChild(wrapper);
    definirElementActif(wrapper);
    rendreInteractif(wrapper);
}

function definirElementActif(item) {
    if (activeCanvasItem) activeCanvasItem.classList.remove('active-item');
    activeCanvasItem = item;
    if (item) {
        item.classList.add('active-item');
        // Mettre au premier plan : récupérer le z-index max et ajouter 1
        const allItems = document.querySelectorAll('#outfit-canvas .canvas-item');
        let maxZIndex = 0;
        allItems.forEach(el => {
            const zIndex = parseInt(window.getComputedStyle(el).zIndex) || 0;
            if (zIndex > maxZIndex) maxZIndex = zIndex;
        });
        item.style.zIndex = maxZIndex + 1;
        // Marquer la tenue comme modifiée pour que l'utilisateur sauvegarde
        outfitDirty = true;
        updateSaveButtonState();
    }
}

outfitCanvas.addEventListener('pointerdown', (e) => {
    if (e.target === outfitCanvas || e.target.classList.contains('silhouette') || e.target.id === 'canvas-hint') {
        definirElementActif(null);
    }
});

function rendreInteractif(el) {
    const resizeHandle = el.querySelector('.resize-handle');
    const rotateHandle = el.querySelector('.rotate-handle');
    const deleteHandle = el.querySelector('.delete-handle');

    deleteHandle.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); el.remove(); activeCanvasItem = null; outfitDirty = true; updateSaveButtonState(); sauvegarderTenueActuelle();
    });

    let isDragging = false, isResizing = false, isRotating = false;
    let startX, startY, initialX, initialY, initialWidth, initialHeight, center;

    el.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.resize-handle') || e.target.closest('.rotate-handle') || e.target.closest('.delete-handle')) return;
        definirElementActif(el); isDragging = true;
        startX = e.clientX; startY = e.clientY;
        initialX = el.offsetLeft; initialY = el.offsetTop;
        el.setPointerCapture(e.pointerId); e.preventDefault();
    });

    resizeHandle.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); definirElementActif(el); isResizing = true;
        startX = e.clientX; initialWidth = el.offsetWidth; initialHeight = el.offsetHeight;
        el.dataset.ratio = initialWidth / initialHeight;
        resizeHandle.setPointerCapture(e.pointerId); e.preventDefault();
    });

    rotateHandle.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); definirElementActif(el); isRotating = true;
        const canvasRect = outfitCanvas.getBoundingClientRect();
        center = { x: canvasRect.left + el.offsetLeft + (el.offsetWidth / 2), y: canvasRect.top + el.offsetTop + (el.offsetHeight / 2) };
        rotateHandle.setPointerCapture(e.pointerId); e.preventDefault();
    });

    const handlePointerMove = (e) => {
        if (isDragging) { el.style.left = `${initialX + (e.clientX - startX)}px`; el.style.top = `${initialY + (e.clientY - startY)}px`; }
        if (isResizing) {
            const newWidth = initialWidth + (e.clientX - startX);
            if (newWidth > 40) { el.style.width = `${newWidth}px`; el.style.height = `${newWidth / parseFloat(el.dataset.ratio)}px`; }
        }
        if (isRotating) {
            const angle = Math.atan2(e.clientY - center.y, e.clientX - center.x);
            let degree = (angle * 180 / Math.PI) + 90;
            el.style.transform = `rotate(${degree}deg)`; el.dataset.rotation = degree;
        }
    };

    const handlePointerUp = () => { 
        if (isDragging || isResizing || isRotating) {
            outfitDirty = true;
            updateSaveButtonState();
            isDragging = false; isResizing = false; isRotating = false;
            sauvegarderTenueActuelle();
        }
    };

    el.addEventListener('pointermove', handlePointerMove);
    resizeHandle.addEventListener('pointermove', handlePointerMove);
    rotateHandle.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    
    el.addEventListener('pointerup', handlePointerUp); el.addEventListener('pointercancel', handlePointerUp);
    resizeHandle.addEventListener('pointerup', handlePointerUp); rotateHandle.addEventListener('pointerup', handlePointerUp);
}