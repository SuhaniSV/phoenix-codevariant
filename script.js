(() => {
  "use strict";
  const FRAME_COUNT = 116;
  const FRAME_PATH = (index) => `frames/frames_${index + 1}.webp`;
  const MAX_DPR = 1.15;
  const canvas = document.getElementById("introCanvas");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const intro = document.getElementById("intro");
  const loader = document.getElementById("introLoader");
  const loaderBar = document.getElementById("loaderBar");
  const loaderText = document.getElementById("loaderText");
  const frameWarning = document.getElementById("frameWarning");
  const skipIntro = document.getElementById("skipIntro");
  // Start every visit at the first cinematic frame. Prevent the browser from
  // restoring a previous scroll position and accidentally scrubbing the intro.
  if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.classList.add("intro-loading-lock");
  skipIntro.disabled = false;
  let lenis = null;
  const frames = new Array(FRAME_COUNT);
  let loaded = 0, failed = 0, currentFrame = 0, lastDrawn = -1, raf = 0;
  let nextToLoad = 0, loadingWorkers = 0;
  let targetProgress = 0;
  let firstFrameSettled = false;
  let resolveFirstFrameReady;
  const firstFrameReady = new Promise((resolve) => { resolveFirstFrameReady = resolve; });
  function settleFirstFrameReady(success) {
    if (firstFrameSettled) return;
    firstFrameSettled = true;
    resolveFirstFrameReady(success);
  }
  const PROFILE_STORAGE_KEY = "phoenix-profile";
  const GITHUB_CONNECTION_KEY = "phoenix-github-demo-connected";
  const defaultProfile = { displayName: "Phoenix Member", avatar: "👤", bio: "Saving forgotten ideas and helping them rise again.", notifications: true };
  let profile = { ...defaultProfile };
  try {
    const savedProfile = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "null");
    if (savedProfile && typeof savedProfile === "object") profile = { ...profile, ...savedProfile };
  } catch (_) {}
  let connected = false;
  try { connected = localStorage.getItem(GITHUB_CONNECTION_KEY) === "true"; } catch (_) {}
  let activePage = "Home";
  let currentFilter = "Home";
  let selectedProject = null;
  let hallCategory = "all";
  let mapZoom = 1;
  let phoenixLeafletMap = null;
  let projects = [
    { id: 1, name: "StudySphere", description: "An open-source study planner with unfinished collaboration tools and documentation.", language: "TypeScript", lastCommit: "1 year ago", status: "Graveyard", stars: 124, needs: ["Documentation", "Frontend"], repo: "https://github.com/topics/education" },
    { id: 2, name: "EcoTrack", description: "A carbon-footprint tracker that needs better data sources and a completed dashboard.", language: "JavaScript", lastCommit: "1 year ago", status: "Graveyard", stars: 98, needs: ["Backend", "Data"], repo: "https://github.com/topics/carbon-footprint" },
    { id: 3, name: "MediScan AI", description: "An experimental medical-image analysis project seeking documentation and model evaluation.", language: "Python", lastCommit: "2 years ago", status: "Memorial Garden", stars: 76, needs: ["ML", "Documentation"], repo: "https://github.com/topics/machine-learning", revived: "Recently revived", gardenTech: "Python", gardenArt: "taskflow" },
    { id: 4, name: "TaskFlow", description: "A focused task manager that returned with a simpler workflow and fresh release notes.", language: "JavaScript", lastCommit: "2 months ago", status: "Memorial Garden", stars: 124, needs: ["UI/UX", "Testing"], repo: "https://github.com/topics/task-management", revived: "Revived 2 months ago", gardenTech: "Next.js", gardenArt: "taskflow" },
    { id: 7, name: "GreenCart", description: "A sustainable shopping planner revived with a cleaner catalogue and green delivery ideas.", language: "React", lastCommit: "3 months ago", status: "Memorial Garden", stars: 98, needs: ["Design", "Testing"], repo: "https://github.com/topics/sustainability", revived: "Revived 3 months ago", gardenTech: "React", gardenArt: "greencart" },
    { id: 8, name: "Eventify", description: "An event planning project brought back with a polished discovery flow and live community calendar.", language: "Python", lastCommit: "1 month ago", status: "Memorial Garden", stars: 76, needs: ["Backend", "Documentation"], repo: "https://github.com/topics/event-management", revived: "Revived 1 month ago", gardenTech: "Django", gardenArt: "eventify" },
    { id: 9, name: "HealthMate", description: "A wellbeing companion revived with daily check-ins and a calmer, accessible mobile experience.", language: "Dart", lastCommit: "4 months ago", status: "Memorial Garden", stars: 88, needs: ["Mobile", "Accessibility"], repo: "https://github.com/topics/health-app", revived: "Revived 4 months ago", gardenTech: "Flutter", gardenArt: "healthmate" },
    { id: 5, name: "MediScan AI", description: "An AI-assisted imaging workspace that launched with a clear review flow and clinician dashboard.", language: "Python", lastCommit: "2 months ago", status: "Hall of Fame", stars: 124, needs: ["AI", "Healthcare"], repo: "https://github.com/topics/machine-learning", hallLaunch: "Launched 2 months ago", hallRank: 2, hallSignals: 32, hallArt: "mediscan", hallCategories: ["web", "featured"] },
    { id: 6, name: "CampusConnect", description: "A community platform that launched with campus groups, events, and a contribution guide.", language: "Java", lastCommit: "3 months ago", status: "Hall of Fame", stars: 98, needs: ["Backend", "Community"], repo: "https://github.com/topics/campus", hallLaunch: "Launched 3 months ago", hallRank: 3, hallSignals: 21, hallArt: "campus", hallCategories: ["mobile", "open-source", "featured"] }
  ];
  try {
    const storedStatuses = JSON.parse(localStorage.getItem("phoenix-project-statuses") || "{}");
    projects.forEach((project) => {
      const saved = storedStatuses[project.id];
      if (saved) {
        if (saved.status === "Under Revival") {
          saved.status = "Memorial Garden";
          saved.revived = saved.revived || "Recently revived";
        }
        Object.assign(project, saved);
      }
    });
    const localSubmissions = JSON.parse(localStorage.getItem("phoenix-local-projects") || "[]");
    localSubmissions.forEach((project) => {
      if (project.status === "Under Revival") {
        project.status = "Memorial Garden";
        project.revived = project.revived || "Recently revived";
      }
      if (!projects.some((item) => item.id === project.id)) projects.push(project);
    });
    // Migrate any status left by previous versions so the retired tab cannot return.
    projects.forEach((project) => {
      if (project.status === "Under Revival") {
        project.status = "Memorial Garden";
        project.revived = project.revived || "Recently revived";
      }
    });
    persistProjectStatuses();
  } catch (_) {}
  let flowerCounts = {};
  try { flowerCounts = JSON.parse(localStorage.getItem("phoenix-flower-counts") || "{}"); } catch (_) { flowerCounts = {}; }
  function persistProjectStatuses() {
    try { localStorage.setItem("phoenix-project-statuses", JSON.stringify(Object.fromEntries(projects.map((project) => [project.id, { status: project.status, revived: project.revived }])))); } catch (_) {}
    try { localStorage.setItem("phoenix-local-projects", JSON.stringify(projects.filter((project) => project.localSubmission))); } catch (_) {}
  }
  let projectVotes = {};
  try { projectVotes = JSON.parse(localStorage.getItem("phoenix-project-votes") || "{}"); } catch (_) { projectVotes = {}; }
  function getProjectVotes(id) { const project = projects.find((item) => item.id === id); const seedDislikes = { 1: 32, 2: 21, 3: 28, 4: 19 }; return projectVotes[id] || { likes: project ? project.stars : 0, dislikes: seedDislikes[id] || 0, vote: "" }; }
  function voteForProject(id, kind) {
    const current = getProjectVotes(id);
    if (current.vote === kind) {
      current[kind === "like" ? "likes" : "dislikes"] = Math.max(0, current[kind === "like" ? "likes" : "dislikes"] - 1);
      current.vote = "";
    } else {
      if (current.vote) current[current.vote === "like" ? "likes" : "dislikes"] = Math.max(0, current[current.vote === "like" ? "likes" : "dislikes"] - 1);
      current[kind === "like" ? "likes" : "dislikes"] += 1;
      current.vote = kind;
    }
    projectVotes[id] = current;
    try { localStorage.setItem("phoenix-project-votes", JSON.stringify(projectVotes)); } catch (_) {}
    renderProjects();
  }

  let communityPosts = [
    { title: "Looking for a React contributor", tag: "Frontend", replies: 8 },
    { title: "How should I split a large legacy API?", tag: "Backend", replies: 5 },
    { title: "Good first issues for ML beginners", tag: "AI / ML", replies: 12 }
  ];
  function hasPhoenixBackend() {
    const config = window.PHOENIX_SUPABASE_CONFIG || {};
    return typeof config.url === "string" && /^https:\/\//.test(config.url) && !config.url.includes("YOUR_SUPABASE") && typeof config.anonKey === "string" && config.anonKey.length > 12 && !config.anonKey.includes("YOUR_SUPABASE");
  }
  async function phoenixApi(table, options = {}) {
    const config = window.PHOENIX_SUPABASE_CONFIG || {};
    if (!hasPhoenixBackend()) throw new Error("Supabase is not configured for this project.");
    const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(table)}`, {
      ...options,
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json", ...(options.headers || {}) }
    });
    if (!response.ok) throw new Error((await response.text()) || `Supabase returned ${response.status}`);
    return response.status === 204 ? null : response.json().catch(() => null);
  }

  function drawFrame(index) {
    index = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(index)));
    if (index === lastDrawn) return;
    const image = frames[index];
    if (!image || !image.complete || !image.naturalWidth) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
    ctx.fillStyle = "#08090d"; ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
    lastDrawn = index;
  }
  function scheduleDraw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => drawFrame(currentFrame));
  }
  function updateScroll() {
    if (!intro || intro.hidden) return;
    const rect = intro.getBoundingClientRect();
    const scrollable = Math.max(1, intro.offsetHeight - window.innerHeight);
    const passed = Math.min(scrollable, Math.max(0, -rect.top));
    targetProgress = Math.min(1, passed / scrollable);

    const nextFrame = Math.round(targetProgress * (FRAME_COUNT - 1));
    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      scheduleDraw();
    }

    // In the final moment, fade in the complete landing page and navbar as
    // one composition. Keep it there until the real landing section reaches
    // the viewport; don't reveal a lone PHOENIX title.
    const reachedLanding = window.scrollY >= intro.offsetTop + intro.offsetHeight - 1;
    const previewLanding = !reachedLanding && targetProgress >= 0.99;
    document.body.classList.toggle("landing-preview", previewLanding);
    document.body.classList.toggle("landing-revealed", reachedLanding);
  }

  // Lenis smooths the page's native scrolling. Its scroll event also drives
  // the canvas sequence so frame changes stay synced with the smoothed scroll.
  if (typeof window.Lenis === "function") {
    lenis = new window.Lenis({
      autoRaf: true,
      anchors: true,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
      // Keep wheel input responsive without making the cinematic scrub feel jumpy.
      lerp: 0.11,
      wheelMultiplier: 1,
      touchMultiplier: 1
    });
    lenis.stop();
    lenis.on("scroll", updateScroll);
  } else {
    console.warn("Lenis did not load. Falling back to native browser scrolling.");
  }

  function scrollToElement(element, options = {}) {
    if (lenis) {
      lenis.scrollTo(element, { duration: 1.05, offset: -16, ...options });
    } else {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function skipIntroSequence() {
    // Skip moves to Home without removing the cinematic section. This keeps
    // the frame-by-frame animation available whenever the visitor scrolls
    // back to the top or reloads the site.
    loader.hidden = true;
    document.documentElement.classList.remove("intro-loading-lock");
    if (lenis) lenis.start();
    scrollToElement(document.getElementById("landing"), { offset: 0 });
  }
  async function loadWorker() {
    while (true) {
      const index = nextToLoad++;
      if (index >= FRAME_COUNT) return;
      const image = new Image();
      image.decoding = "async";
      frames[index] = image;
      try {
        const succeeded = await new Promise((resolve) => {
          image.onload = () => {
            if (index === 0) {
              settleFirstFrameReady(true);
              frameWarning.hidden = true;
            }
            // A frame may finish loading after the scroll has already reached it.
            // Redraw on completion so the canvas never stays black or frozen there.
            if (index === currentFrame) {
              lastDrawn = -1;
              scheduleDraw();
            }
            resolve(true);
          };
          image.onerror = () => {
            if (index === 0) settleFirstFrameReady(false);
            resolve(false);
          };
          image.src = FRAME_PATH(index);
        });
        if (!succeeded || !image.naturalWidth) {
          failed++;
          console.warn("Could not load frame:", FRAME_PATH(index));
        } else {
          // Decode before the user can scrub to this frame, avoiding decode stutters.
          try { await image.decode(); } catch (_) { /* Some browsers decode on draw. */ }
          if (index === currentFrame) {
            lastDrawn = -1;
            scheduleDraw();
          }
        }
      } catch (error) {
        if (index === 0) settleFirstFrameReady(false);
        failed++;
        console.warn("Could not load frame:", FRAME_PATH(index), error);
      } finally {
        loaded++;
        const progress = Math.round(loaded / FRAME_COUNT * 100);
        loaderBar.style.width = `${progress}%`;
        loaderText.textContent = `${progress}%`;
      }
    }
  }

  async function startFrameLoading() {
    // Start all frame workers immediately, but don't wait for ~20 MB of assets.
    // The intro becomes usable as soon as frame 1 is available; the rest load
    // in the background and redraw themselves if the visitor has scrubbed ahead.
    const workerCount = Math.min(6, FRAME_COUNT);
    const loading = Promise.all(Array.from({ length: workerCount }, () => loadWorker()));
    loading.catch((error) => console.warn("Intro frame loading stopped:", error));

    const firstFrameTimeout = new Promise((resolve) => window.setTimeout(() => resolve(false), 10000));
    const firstFrameLoaded = await Promise.race([firstFrameReady, firstFrameTimeout]);

    if (!firstFrameLoaded) {
      frameWarning.hidden = false;
      frameWarning.textContent = "The first intro frame is taking too long to load. Check that frames/frames_1.webp is accessible.";
    }

    loader.hidden = true;
    document.documentElement.classList.remove("intro-loading-lock");
    skipIntro.disabled = false;
    if (lenis) lenis.start();
    lastDrawn = -1;
    drawFrame(currentFrame);
    updateScroll();
  }

  const pageDescriptions = {
    Home: "Find unfinished ideas worth saving and contributors ready to help.",
    Graveyard: "Inactive or owner-listed projects looking for their next chapter.",
    "Memorial Garden": "Projects that have reached an agreed revival milestone.",
    "Hall of Fame": "Projects with a verified release, deployment, or public outcome.",
    Community: "Ask for help, share knowledge, and find collaborators.",
    "World Cemetery": "Explore project locations shared voluntarily by their owners."
  };
  const pageRoutes = { Home: "landing", Graveyard: "graveyard", "Memorial Garden": "memorial-garden", "Hall of Fame": "hall-of-fame", "World Cemetery": "map", Community: "community", "Project Tombstone": "tombstone" };
  function getRouteDetails() {
    const route = window.location.hash.replace(/^#/, "") || "landing";
    const tombstoneMatch = route.match(/^tombstone-(\d+)$/);
    if (tombstoneMatch) return { page: "Project Tombstone", projectId: Number(tombstoneMatch[1]) };
    if (route === "under-revival") return { page: "Memorial Garden", projectId: null };
    return { page: Object.keys(pageRoutes).find((page) => pageRoutes[page] === route) || "Home", projectId: null };
  }
  function resolvePageFromHash() {
    return getRouteDetails().page;
  }
  function setPage(page, fromHistory = false, projectId = null) {
    const routeDetails = getRouteDetails();
    let isTombstone = page === "Project Tombstone";
    if (isTombstone) {
      const targetId = Number(projectId ?? routeDetails.projectId ?? selectedProject?.id);
      selectedProject = projects.find((project) => project.id === targetId) || null;
      if (!selectedProject) {
        page = "Graveyard";
        isTombstone = false;
      }
    }
    if (!fromHistory) {
      const route = isTombstone ? `tombstone-${selectedProject.id}` : (pageRoutes[page] || "landing");
      if (window.location.hash !== `#${route}`) window.history.pushState({ phoenixPage: page }, "", `#${route}`);
    }
    activePage = page;
    const isHome = page === "Home";
    if (!isHome) {
      // Landing-only action-zone filtering must not leak into app pages.
      document.body.classList.remove("landing-preview", "landing-revealed");
      const aiPanel = document.getElementById("aiAssistantPanel");
      if (aiPanel && !aiPanel.hidden) {
        aiPanel.hidden = true;
        aiPanel.classList.remove("is-open");
        document.getElementById("aiAssistantButton").setAttribute("aria-expanded", "false");
      }
    }
    if (["Home", "Graveyard", "Memorial Garden", "Hall of Fame"].includes(page)) currentFilter = page;
    if (isTombstone) currentFilter = "Graveyard";
    document.body.classList.toggle("page-view-open", !isHome);
    // Clicking Home from a dashboard should show the actual landing page,
    // not return to the dark cinematic intro or leave the hero hidden.
    document.body.classList.toggle("home-direct", isHome);
    if (isHome) {
      document.body.classList.add("landing-revealed");
      document.body.classList.remove("landing-preview");
      document.documentElement.classList.remove("intro-loading-lock");
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      if (lenis) lenis.start();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
    const isMemorialGarden = page === "Memorial Garden";
    const isHallOfFame = page === "Hall of Fame";
    document.body.classList.toggle("graveyard-page", page === "Graveyard" || isTombstone);
    document.body.classList.toggle("memorial-garden-page", isMemorialGarden);
    document.body.classList.toggle("hall-of-fame-page", isHallOfFame);
    document.body.classList.toggle("map-page", page === "World Cemetery");
    document.body.classList.toggle("project-detail-page", isTombstone);
    document.body.classList.toggle("filters-open", false);
    document.body.dataset.activePage = page;
    const appContent = document.getElementById("appContent");
    appContent.hidden = isHome;
    const navigationPage = isTombstone ? "Graveyard" : page;
    document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.page === navigationPage));
    const titles = { Home: "Projects waiting for a second chance", Graveyard: "Project Graveyard", "World Cemetery": "World Cemetery Map" };
    document.getElementById("pageTitle").textContent = titles[page] || page;
    const graveyardEyebrow = document.querySelector("#appContent .graveyard-heading .eyebrow");
    if (graveyardEyebrow) graveyardEyebrow.textContent = (page === "Graveyard" || isTombstone) ? "PHOENIX · ABANDONED PROJECT" : "PHOENIX · PROJECT ARCHIVE";
    document.getElementById("pageDescription").textContent = page === "Graveyard" ? "Abandoned ideas, waiting for revival." : pageDescriptions[page] || pageDescriptions.Home;
    document.getElementById("projectsView").hidden = isHome || page === "Community" || page === "World Cemetery" || isTombstone || isMemorialGarden || isHallOfFame;
    document.getElementById("memorialGardenView").hidden = isHome || !isMemorialGarden;
    document.getElementById("hallOfFameView").hidden = isHome || !isHallOfFame;
    document.getElementById("communityView").hidden = isHome || page !== "Community";
    document.getElementById("mapView").hidden = isHome || page !== "World Cemetery";
    if (page === "World Cemetery") renderMapPins();
    document.getElementById("projectDetailView").hidden = isHome || !isTombstone;
    document.querySelectorAll(".filter-tab").forEach((button) => button.classList.toggle("selected", button.dataset.filter === currentFilter));
    if (isTombstone) {
      renderProjectDetail();
    } else if (isMemorialGarden) {
      renderMemorialGarden();
    } else if (isHallOfFame) {
      renderHallOfFame();
    } else {
      renderProjects();
      renderMapPins();
    }
    if (isHome) {
      if (lenis) lenis.start();
      requestAnimationFrame(() => scrollToElement(document.getElementById("landing"), { offset: 0 }));
    } else {
      if (lenis) lenis.stop();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function updateNewProjectDraftCard() {
    const form = document.getElementById("newProjectForm");
    const card = document.getElementById("newProjectDraftCard");
    if (!form || !card) return;
    const values = new FormData(form);
    const lat = Number(values.get("latitude")), lon = Number(values.get("longitude"));
    const ready = form.checkValidity() && String(values.get("name") || "").trim() && String(values.get("description") || "").trim() && String(values.get("city") || "").trim() && Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
    card.draggable = Boolean(ready);
    card.classList.toggle("is-ready", Boolean(ready));
    const title = card.querySelector("strong"), preview = card.querySelector(".canvas-draft-preview");
    if (title) title.textContent = ready ? `Submit ${String(values.get("name")).trim()}` : "Complete the required fields";
    if (preview) preview.textContent = ready ? `${String(values.get("city")).trim()} · coordinates validated · drag to Add Project` : "The card unlocks when your project details and coordinates are valid.";
  }
  function canvasFeedback(message, isError = false) {
    const status = document.getElementById("canvasStatus");
    const dock = document.getElementById("canvasProtocol");
    if (status) status.textContent = message;
    if (dock) {
      dock.classList.toggle("has-error", Boolean(isError));
      dock.classList.add("has-feedback");
      window.clearTimeout(dock._feedbackTimer);
      dock._feedbackTimer = window.setTimeout(() => dock.classList.remove("has-feedback", "has-error"), 5000);
    }
  }
  function canvasDispatch(action, payload) {
    document.dispatchEvent(new CustomEvent("phoenix:canvas-action", { detail: { action, payload } }));
  }
  function canvasPayloadForCard(card) {
    const type = card.dataset.dragType;
    const projectId = Number(card.dataset.projectId || 0);
    if (type === "project" || type === "flower-tribute" || type === "revival-plan" || type === "regenerate-plan" || type === "revival-task" || type === "copy-plan" || type === "copy-invite" || type === "github-disconnect") {
      return { type, projectId, taskId: card.dataset.taskId || "" };
    }
    if (type === "bookmark") return { type, projectId, key: card.dataset.bookmarkKey || "", title: card.dataset.projectTitle || "" };
    if (type === "community-question") {
      const title = document.getElementById("communityTopic")?.value.trim() || "";
      const body = document.getElementById("communityBody")?.value.trim() || "";
      return { type, title, body, tag: document.getElementById("communityCategory")?.value || "Community", notify: document.getElementById("communityNotify")?.checked !== false };
    }
    if (type === "project-discussion") return { type, projectId, projectName: card.dataset.projectName || "Open-source project" };
    if (type === "new-project") {
      const form = document.getElementById(card.dataset.formId || "newProjectForm");
      if (!form) return { type };
      const values = new FormData(form);
      return { type, name: String(values.get("name") || "").trim(), description: String(values.get("description") || "").trim(), city: String(values.get("city") || "").trim(), latitude: Number(values.get("latitude")), longitude: Number(values.get("longitude")), repository_url: String(values.get("repository_url") || "").trim() };
    }
    if (["profile-save", "notifications-save", "settings-save"].includes(type)) {
      const form = document.getElementById(card.dataset.formId || "");
      if (!form) return { type };
      const values = new FormData(form);
      return { type, values: Object.fromEntries(values.entries()) };
    }
    if (type === "github-import") {
      const rows = Array.from(document.querySelectorAll("#modalContent .repo-row"));
      return { type, repositories: rows.filter((row) => row.querySelector("input[type=checkbox]")?.checked).map((row) => ({ name: row.dataset.repoName || "Imported project", description: row.dataset.repoDescription || "Public demo repository" })) };
    }
    if (type === "ai-message") {
      const input = document.getElementById(card.dataset.inputId || "aiAssistantInput");
      return { type, inputId: card.dataset.inputId || "aiAssistantInput", message: input?.value.trim() || "" };
    }
    return { type, projectId };
  }
  function makeCanvasCard(card) { return Boolean(card && card.dataset.dragType); }
  function initCanvasProtocol() {
    const dock = document.getElementById("canvasProtocol");
    if (!dock) return;
    document.addEventListener("dragstart", (event) => {
      const card = event.target.closest?.("[data-drag-type]");
      if (!makeCanvasCard(card) || card.draggable === false) { event.preventDefault(); return; }
      const payload = canvasPayloadForCard(card);
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-phoenix-canvas", JSON.stringify(payload));
      event.dataTransfer.setData("text/plain", JSON.stringify(payload));
      card.classList.add("is-dragging");
      dock.classList.add("is-drag-active");
    });
    document.addEventListener("dragend", (event) => {
      event.target.closest?.("[data-drag-type]")?.classList.remove("is-dragging");
      dock.classList.remove("is-drag-active");
      dock.querySelectorAll(".canvas-zone.is-over").forEach((zone) => zone.classList.remove("is-over"));
    });
    dock.querySelectorAll("[data-drop-action]").forEach((zone) => {
      zone.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; zone.classList.add("is-over"); });
      zone.addEventListener("dragleave", (event) => { if (!zone.contains(event.relatedTarget)) zone.classList.remove("is-over"); });
      zone.addEventListener("drop", (event) => {
        event.preventDefault(); zone.classList.remove("is-over");
        let payload = null;
        try { payload = JSON.parse(event.dataTransfer.getData("application/x-phoenix-canvas") || event.dataTransfer.getData("text/plain")); } catch (_) {}
        if (!payload || !payload.type) { canvasFeedback("That card could not be read. Try dragging a Phoenix data card.", true); return; }
        void performCanvasAction(zone.dataset.dropAction, payload);
      });
    });
    // Native HTML drag-and-drop is inconsistent on touchscreens, so provide a pointer-drag fallback for touch input.
    let touchDrag = null, dragGhost = null, ignoreClickFor = null;
    function cleanTouchDrag() {
      if (touchDrag?.card) touchDrag.card.classList.remove("is-dragging");
      if (dragGhost) dragGhost.remove();
      dragGhost = null; touchDrag = null;
      dock.classList.remove("is-drag-active");
      dock.querySelectorAll(".canvas-zone.is-over").forEach((zone) => zone.classList.remove("is-over"));
    }
    document.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      const card = event.target.closest?.("[data-drag-type]");
      if (!makeCanvasCard(card) || card.draggable === false || event.target.closest("button,a,input,textarea,select,label[for]")) return;
      touchDrag = { card, payload: canvasPayloadForCard(card), pointerId: event.pointerId, x: event.clientX, y: event.clientY, started: false };
    }, { passive: true });
    document.addEventListener("pointermove", (event) => {
      if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
      if (!touchDrag.started && Math.hypot(event.clientX - touchDrag.x, event.clientY - touchDrag.y) < 9) return;
      event.preventDefault();
      if (!touchDrag.started) {
        touchDrag.started = true;
        touchDrag.card.classList.add("is-dragging");
        dragGhost = touchDrag.card.cloneNode(true);
        dragGhost.classList.add("canvas-drag-ghost"); dragGhost.removeAttribute("id"); dragGhost.draggable = false;
        document.body.appendChild(dragGhost); dock.classList.add("is-drag-active");
      }
      if (dragGhost) { dragGhost.style.left = `${event.clientX + 12}px`; dragGhost.style.top = `${event.clientY + 12}px`; }
      const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-drop-action]");
      dock.querySelectorAll(".canvas-zone").forEach((item) => item.classList.toggle("is-over", item === zone));
    }, { passive: false });
    document.addEventListener("pointerup", (event) => {
      if (!touchDrag || touchDrag.pointerId !== event.pointerId) return;
      const session = touchDrag;
      const zone = session.started ? document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-drop-action]") : null;
      if (zone) { ignoreClickFor = session.card; window.setTimeout(() => { ignoreClickFor = null; }, 400); void performCanvasAction(zone.dataset.dropAction, session.payload); }
      cleanTouchDrag();
    });
    document.addEventListener("pointercancel", (event) => { if (touchDrag?.pointerId === event.pointerId) cleanTouchDrag(); });
    document.addEventListener("click", (event) => { if (ignoreClickFor && (event.target === ignoreClickFor || ignoreClickFor.contains(event.target))) { event.preventDefault(); event.stopImmediatePropagation(); ignoreClickFor = null; } }, true);
    document.getElementById("communityForm")?.addEventListener("input", updateCommunityDraftCard);
    document.getElementById("communityForm")?.addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the community draft card to Publish."); });
    document.getElementById("aiAssistantInput")?.addEventListener("input", updateAiMessageDraft);
    document.getElementById("aiAssistantForm")?.addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the message card to Send Message."); });
    updateCommunityDraftCard();
    updateAiMessageDraft();
  }
  function updateCommunityDraftCard() {
    const title = document.getElementById("communityTopic")?.value.trim() || "";
    const body = document.getElementById("communityBody")?.value.trim() || "";
    const card = document.getElementById("communityDraftCard");
    if (!card) return;
    const ready = Boolean(title && body);
    card.draggable = ready;
    card.classList.toggle("is-ready", ready);
    const heading = card.querySelector("strong"), preview = card.querySelector(".canvas-draft-preview");
    if (heading) heading.textContent = ready ? title : "Complete the title and description";
    if (preview) preview.textContent = ready ? `${body.length > 118 ? `${body.slice(0, 115)}…` : body} · drag to Publish` : "Your question becomes draggable when required fields are ready.";
  }
  async function performCanvasAction(action, payload) {
    const project = projects.find((item) => item.id === Number(payload.projectId));
    if (["revive", "support", "needs-work", "flower"].includes(action) && !project && !["revival-plan", "regenerate-plan", "revival-task"].includes(payload.type)) {
      canvasFeedback("This zone needs a project or action card. Drag a matching data card here.", true); return;
    }
    if (action === "revive") {
      if (payload.type === "project" && project) {
        if (project.status === "Graveyard") {
          project.status = "Memorial Garden";
          project.revived = "Revived just now";
          project.gardenTech = project.gardenTech || project.language;
          project.gardenArt = project.gardenArt || "taskflow";
          persistProjectStatuses();
          currentFilter = "Memorial Garden";
          setPage("Memorial Garden");
          canvasFeedback(`${project.name} has been revived and moved to Memorial Garden.`);
        } else if (project.status === "Hall of Fame") {
          canvasFeedback(`${project.name} is already launched in the Hall of Fame.`);
        } else if (project.status === "Memorial Garden") {
          currentFilter = "Memorial Garden";
          setPage("Memorial Garden");
          canvasFeedback(`${project.name} is already in Memorial Garden.`);
        } else {
          canvasFeedback("Only projects from the Graveyard can be revived.", true);
        }
        return;
      }
      if (payload.type === "revival-plan" && project) {
        // Opening a plan is not itself a revival; only dropping the project card
        // into Revive moves it from Graveyard to Memorial Garden.
        canvasDispatch(action, payload);
        canvasFeedback(`Revival plan opened for ${project.name}.`);
        return;
      }
      if (payload.type === "regenerate-plan") { canvasDispatch(action, payload); canvasFeedback("A fresh demo revival plan is ready."); return; }
      canvasFeedback("Drop a project data card here to start its revival.", true); return;
    }
    if (action === "support" || action === "needs-work") {
      if (payload.type !== "project" || !project) { canvasFeedback("Drag a project data card here to record your vote.", true); return; }
      voteForProject(project.id, action === "support" ? "like" : "dislike");
      canvasFeedback(`${action === "support" ? "Support recorded for" : "Needs-work flag recorded for"} ${project.name}.`); return;
    }
    if (action === "flower") {
      if (!project || !["project", "flower-tribute"].includes(payload.type)) { canvasFeedback("Drag a project or flower-tribute card here.", true); return; }
      flowerCounts[project.id] = Number(flowerCounts[project.id] || 12) + 1;
      try { localStorage.setItem("phoenix-flower-counts", JSON.stringify(flowerCounts)); } catch (_) {}
      const counter = document.getElementById("detailFlowerCount"); if (counter && selectedProject?.id === project.id) counter.textContent = `${flowerCounts[project.id]} flowers`;
      canvasFeedback(`A flower has been left for ${project.name}.`); return;
    }
    if (action === "save") {
      if (payload.type === "bookmark") { canvasDispatch(action, payload); canvasFeedback(`${payload.title || "Project"} saved to your canvas bookmarks.`); return; }
      if (payload.type === "profile-save") {
        profile.displayName = payload.values?.displayName; profile.avatar = payload.values?.avatar; profile.bio = payload.values?.bio; saveProfile(); closeModal(); openProfileOverview(); canvasFeedback("Profile changes saved."); return;
      }
      if (payload.type === "notifications-save") {
        profile.notifications = payload.values?.notifications === "on"; saveProfile(); closeModal(); canvasFeedback("Notification preferences saved."); return;
      }
      if (payload.type === "settings-save") {
        profile.notifications = payload.values?.notifications === "on";
        const reduceMotion = payload.values?.reduceMotion === "on";
        try { localStorage.setItem("phoenix-reduce-motion", String(reduceMotion)); } catch (_) {}
        document.documentElement.classList.toggle("phoenix-reduce-motion", reduceMotion); saveProfile(); closeModal(); canvasFeedback("Preferences saved."); return;
      }
      if (["copy-plan", "copy-invite"].includes(payload.type)) { canvasDispatch(action, payload); canvasFeedback(payload.type === "copy-plan" ? "Copying the revival plan…" : "Copying contributor invite…"); return; }
      canvasFeedback("Drag a bookmark, profile draft, or preferences card to Save.", true); return;
    }
    if (action === "publish") {
      if (payload.type === "community-question") {
        if (!payload.title || !payload.body) { canvasFeedback("Add a title and description before publishing the question.", true); return; }
        communityPosts.unshift({ title: payload.title, body: payload.body, tag: payload.tag || "Community", replies: 0, createdAt: Date.now(), notify: payload.notify });
        const form = document.getElementById("communityForm"); form?.reset(); updateCommunityDraftCard(); renderCommunity(); setPage("Community");
        canvasFeedback("Your question has been published to Latest discussions."); return;
      }
      if (payload.type === "project-discussion" && project) {
        communityPosts.unshift({ title: `Discussion: ${payload.projectName || project.name}`, body: `Share a practical revival note or offer help with ${payload.projectName || project.name}.`, tag: "Open Source", replies: 0, createdAt: Date.now() });
        renderCommunity(); setPage("Community"); canvasFeedback("Project discussion added to the Phoenix Community."); return;
      }
      canvasFeedback("Drag a completed community or discussion card to Publish.", true); return;
    }
    if (action === "add-project") {
      if (payload.type !== "new-project") { canvasFeedback("Drag the completed project submission card here.", true); return; }
      const { name, description, city, latitude, longitude, repository_url } = payload;
      if (!name || !description || !city || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) { canvasFeedback("Check every required field and use valid latitude / longitude.", true); return; }
      if (hasPhoenixBackend()) {
        try {
          await phoenixApi("projects", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name, description, city, latitude, longitude, repository_url: repository_url || null, status: "pending" }) });
          closeModal(); openModal("Project submitted", "<p class='muted'>Thanks! Your project has been sent for review. It will appear on the map after approval by a Phoenix moderator.</p>");
          canvasFeedback("Project submitted for review.");
        } catch (error) { console.error("Project submission failed:", error); canvasFeedback(error.message || "Project submission failed.", true); }
        return;
      }
      const created = { id: Math.max(0, ...projects.map((item) => Number(item.id) || 0)) + 1, name, description, city, latitude, longitude, language: "Open Source", lastCommit: "Just submitted", status: "Graveyard", stars: 0, needs: ["Community review", "Documentation"], repo: repository_url || "https://github.com/topics/open-source", localSubmission: true };
      projects.push(created); persistProjectStatuses(); closeModal(); currentFilter = "Graveyard"; setPage("Graveyard");
      canvasFeedback(`${name} added to your local demo Graveyard. Connect Supabase for shared review submissions.`); return;
    }
    if (action === "explore") {
      if (payload.type !== "explore-projects") { canvasFeedback("Drag the Explore Projects card to this zone.", true); return; }
      currentFilter = "Graveyard"; setPage("Graveyard"); canvasFeedback("Explore the Graveyard: choose a project tile to open its details."); return;
    }
    if (action === "connect") {
      if (payload.type === "landing-github") { openGithubModal(); canvasFeedback("GitHub action opened. Drag its action card to Connect to continue."); return; }
      if (payload.type === "github-connect") { setGithubConnection(true); closeModal(); openRepoPicker(); canvasFeedback("Demo GitHub connected. Choose repositories and drag the import card to Import."); return; }
      if (payload.type === "github-disconnect") { setGithubConnection(false); closeModal(); openProfileOverview(); canvasFeedback("Demo GitHub disconnected."); return; }
      canvasFeedback("Drag a GitHub connect or disconnect card here.", true); return;
    }
    if (action === "import") {
      if (payload.type !== "github-import") { canvasFeedback("Drag the repository batch card here after selecting repositories.", true); return; }
      const repositories = payload.repositories || [];
      if (!repositories.length) { canvasFeedback("Select at least one repository before dragging the import card.", true); return; }
      let added = 0;
      repositories.forEach((entry) => {
        const name = String(entry.name || "Imported project").trim();
        const existing = projects.find((item) => item.name.toLowerCase() === name.toLowerCase());
        if (existing) { existing.status = existing.status === "Hall of Fame" ? existing.status : "Graveyard"; return; }
        projects.push({ id: Math.max(0, ...projects.map((item) => Number(item.id) || 0)) + 1, name, description: `Imported demo repository. ${entry.description || "Ready for a revival review."}`, language: /Python/i.test(entry.description) ? "Python" : /JavaScript/i.test(entry.description) ? "JavaScript" : "TypeScript", lastCommit: "Imported from demo GitHub", status: "Graveyard", stars: 0, needs: ["Review repository", "Documentation"], repo: "https://github.com/topics/open-source", localSubmission: true }); added++;
      });
      persistProjectStatuses(); closeModal(); currentFilter = "Graveyard"; setPage("Graveyard"); canvasFeedback(`${repositories.length} repository card(s) processed · ${added} new project(s) added.`); return;
    }
    if (action === "complete-task") { if (payload.type === "revival-task") { canvasDispatch(action, payload); canvasFeedback("Revival task updated."); } else canvasFeedback("Drag a revival task card here to mark it complete.", true); return; }
    if (action === "send-message") { if (payload.type === "ai-message") { sendAiMessageFromCanvas(payload.message, payload.inputId); } else canvasFeedback("Drag a message draft from Phoenix AI to Send Message.", true); return; }
    canvasFeedback("That action zone is not configured for this card.", true);
  }

  function renderProjects() {
    const navSearchInput = document.getElementById("searchInput");
    const navQuery = navSearchInput ? navSearchInput.value.toLowerCase().trim() : "";
    const graveyardSearch = document.getElementById("graveyardSearch");
    const localQuery = graveyardSearch ? graveyardSearch.value.toLowerCase().trim() : "";
    const query = localQuery || navQuery;
    const language = document.getElementById("languageFilter").value;
    const sort = document.getElementById("graveyardSort")?.value || "popular";
    const list = projects.filter((project) => {
      const statusMatch = currentFilter === "Home" || project.status === currentFilter;
      const queryMatch = !query || `${project.name} ${project.description} ${project.language} ${project.needs.join(" ")}`.toLowerCase().includes(query);
      const langMatch = !language || project.language === language;
      return statusMatch && queryMatch && langMatch;
    });
    if (currentFilter === "Graveyard") {
      list.sort((a, b) => {
        const av = getProjectVotes(a.id), bv = getProjectVotes(b.id);
        if (sort === "disliked") return bv.dislikes - av.dislikes || a.name.localeCompare(b.name);
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "recent") return a.lastCommit.localeCompare(b.lastCommit);
        return bv.likes - av.likes || a.name.localeCompare(b.name);
      });
    }
    const grid = document.getElementById("projectGrid");
    grid.innerHTML = "";
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state"><span>🪦</span><h3>No projects found</h3><p>Try another search or add a project to the Graveyard.</p></div>';
      return;
    }
    list.forEach((project) => {
      const card = document.createElement("article");
      card.className = `project-card${currentFilter === "Graveyard" ? " graveyard-card" : ""}`;
      const artClass = `art-${project.id % 4}`;
      card.innerHTML = `
        <div class="project-art ${artClass}"><span class="art-moon"></span><span class="art-gate">✦</span><span class="art-candle">🕯</span><span class="project-status">${escapeHTML(project.status)}</span></div>
        <div class="project-card-body">
          <div class="project-title-row"><h3>${escapeHTML(project.name)}</h3><span class="language-dot">${escapeHTML(project.language.slice(0,2))}</span></div>
          <p>${escapeHTML(project.description)}</p>
          <div class="project-meta"><span>◷ ${escapeHTML(project.lastCommit)}</span><span>★ ${project.stars}</span></div>
          <div class="tag-row">${project.needs.slice(0,2).map((n) => `<span class="tag">${escapeHTML(n)}</span>`).join("")}</div>
          ${currentFilter === "Graveyard" ? `<div class="vote-actions canvas-vote-hint" aria-label="Canvas actions"><span>♥ ${getProjectVotes(project.id).likes}</span><span>⌁ ${getProjectVotes(project.id).dislikes}</span><small>Drag this project card to Support or Needs Work</small><button class="card-action" type="button">View tombstone <span>↗</span></button></div>` : `<button class="card-action" type="button">View tombstone <span>↗</span></button>`}
        </div>`;
      card.draggable = true;
      card.dataset.dragType = "project";
      card.dataset.projectId = String(project.id);
      card.setAttribute("aria-roledescription", "draggable project data card");
      if (currentFilter === "Graveyard") {
        const engraving = document.createElement("div");
        engraving.className = "graveyard-engraving";
        engraving.innerHTML = `<strong>${escapeHTML(project.name)}</strong><p>${escapeHTML(project.description)}</p><span>${escapeHTML(project.language)}</span>`;
        card.querySelector(".project-art").append(engraving);
        const referenceArt = document.createElement("img");
        referenceArt.className = "graveyard-reference-art";
        referenceArt.src = "assets/graveyard-reference/tombstone-background.jpg";
        referenceArt.alt = `${project.name} tombstone in a candlelit graveyard`;
        card.querySelector(".project-art").prepend(referenceArt);
        card.querySelector(".project-title-row").hidden = true;
      }
      card.querySelectorAll(".start-working-button").forEach((link) => link.addEventListener("click", (event) => event.stopPropagation()));
      const cardAction = card.querySelector(".card-action");
      cardAction.addEventListener("click", () => openProjectDetails(project.id));
      const projectArt = card.querySelector(".project-art");
      projectArt.tabIndex = 0;
      projectArt.setAttribute("role", "button");
      projectArt.setAttribute("aria-label", `Open ${project.name} tombstone`);
      projectArt.addEventListener("click", () => openProjectDetails(project.id));
      projectArt.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProjectDetails(project.id); }
      });
      grid.appendChild(card);
    });
    document.getElementById("graveyardCount").textContent = "1,248";
    document.getElementById("revivedCount").textContent = "312";
  }
  function renderMemorialGarden() {
    const search = document.getElementById("memorialSearch").value.trim().toLowerCase();
    const sort = document.getElementById("memorialSort").value;
    const revived = projects.filter((project) => {
      const matchesSearch = !search || `${project.name} ${project.description} ${project.language} ${project.gardenTech || ""}`.toLowerCase().includes(search);
      return project.status === "Memorial Garden" && matchesSearch;
    });
    revived.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "popular") return b.stars - a.stars;
      return a.id - b.id;
    });
    const grid = document.getElementById("memorialGardenGrid");
    grid.innerHTML = "";
    if (!revived.length) {
      grid.innerHTML = '<div class="memorial-empty"><span>✦</span><h3>No revived projects found</h3><p>Try a different project name or technology.</p></div>';
      return;
    }
    revived.forEach((project) => {
      const card = document.createElement("article");
      card.className = "memorial-card";
      card.draggable = true;
      card.dataset.dragType = "project";
      card.dataset.projectId = String(project.id);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Open ${project.name}`);
      card.innerHTML = `
        <div class="memorial-art"><img src="assets/memorial-garden/${escapeHTML(project.gardenArt || "taskflow")}.webp" alt="${escapeHTML(project.name)} revived project garden"></div>
        <div class="memorial-card-copy"><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.revived || "Recently revived")}</p><span>${escapeHTML(project.gardenTech || project.language)}</span></div>`;
      card.querySelectorAll(".start-working-button").forEach((link) => {
        link.addEventListener("click", (event) => event.stopPropagation());
        link.addEventListener("keydown", (event) => event.stopPropagation());
      });
      const open = () => openProjectDetails(project.id);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
      grid.appendChild(card);
    });
  }
  function renderHallOfFame() {
    const search = document.getElementById("hallSearch").value.trim().toLowerCase();
    const sort = document.getElementById("hallSort").value;
    const launched = projects.filter((project) => {
      const matchesSearch = !search || `${project.name} ${project.description} ${project.language} ${(project.hallCategories || []).join(" ")}`.toLowerCase().includes(search);
      const matchesCategory = hallCategory === "all" || (project.hallCategories || []).includes(hallCategory);
      return project.status === "Hall of Fame" && matchesSearch && matchesCategory;
    });
    launched.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "recent") return (a.hallRank || 99) - (b.hallRank || 99);
      return b.stars - a.stars || a.name.localeCompare(b.name);
    });
    const grid = document.getElementById("hallOfFameGrid");
    grid.innerHTML = "";
    if (!launched.length) {
      grid.innerHTML = '<div class="hall-empty"><span>✦</span><h3>No launched projects found</h3><p>Try another category or project name.</p></div>';
      return;
    }
    launched.forEach((project) => {
      const card = document.createElement("article");
      card.className = "hall-card";
      card.draggable = true;
      card.dataset.dragType = "project";
      card.dataset.projectId = String(project.id);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Open ${project.name}`);
      card.innerHTML = `
        <div class="hall-art hall-art-${escapeHTML(project.hallArt || "mediscan")}" aria-hidden="true"><span class="hall-art-glow"></span><span class="hall-art-title">${escapeHTML(project.language)}</span></div>
        <div class="hall-card-copy"><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.hallLaunch || "Recently launched")}</p><div class="hall-stats"><span>★ ${project.stars}</span><span>✦ ${project.hallSignals || 0}</span></div></div>`;
      card.querySelectorAll(".start-working-button").forEach((link) => {
        link.addEventListener("click", (event) => event.stopPropagation());
        link.addEventListener("keydown", (event) => event.stopPropagation());
      });
      const open = () => openProjectDetails(project.id);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
      grid.appendChild(card);
    });
  }
  function renderMapPins() {
    const holder = document.getElementById("interactiveMap");
    if (!holder || !window.L) return;
    if (!phoenixLeafletMap) {
      phoenixLeafletMap = L.map(holder, { worldCopyJump: true, minZoom: 2, maxZoom: 8 }).setView([20, 10], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }).addTo(phoenixLeafletMap);
      // Illustrative sample locations/counts only, not live submissions.
      // India has multiple city dots; their sample counts add up to the India total.
      const countryTotals = [
        { country: "India", flag: "🇮🇳", count: 342 },
        { country: "USA", flag: "🇺🇸", count: 281 },
        { country: "Germany", flag: "🇩🇪", count: 154 },
        { country: "UK", flag: "🇬🇧", count: 87 },
        { country: "Croatia", flag: "🇭🇷", count: 64 }
      ];
      const sampleProjects = [
        { country: "India", flag: "🇮🇳", count: 72, city: "Bengaluru", coords: [12.9716, 77.5946] },
        { country: "India", flag: "🇮🇳", count: 64, city: "Mumbai", coords: [19.076, 72.8777] },
        { country: "India", flag: "🇮🇳", count: 58, city: "New Delhi", coords: [28.6139, 77.209] },
        { country: "India", flag: "🇮🇳", count: 43, city: "Hyderabad", coords: [17.385, 78.4867] },
        { country: "India", flag: "🇮🇳", count: 38, city: "Chennai", coords: [13.0827, 80.2707] },
        { country: "India", flag: "🇮🇳", count: 31, city: "Pune", coords: [18.5204, 73.8567] },
        { country: "India", flag: "🇮🇳", count: 20, city: "Kolkata", coords: [22.5726, 88.3639] },
        { country: "India", flag: "🇮🇳", count: 16, city: "Jaipur", coords: [26.9124, 75.7873] },
        { country: "USA", flag: "🇺🇸", count: 281, city: "San Francisco", coords: [37.7749, -122.4194] },
        { country: "Germany", flag: "🇩🇪", count: 154, city: "Berlin", coords: [52.52, 13.405] },
        { country: "UK", flag: "🇬🇧", count: 87, city: "London", coords: [51.5072, -0.1276] },
        { country: "Croatia", flag: "🇭🇷", count: 64, city: "Zagreb", coords: [45.815, 15.9819] },
        { country: "Brazil", flag: "🇧🇷", count: 52, city: "São Paulo", coords: [-23.5505, -46.6333] },
        { country: "Japan", flag: "🇯🇵", count: 46, city: "Tokyo", coords: [35.6762, 139.6503] },
        { country: "Kenya", flag: "🇰🇪", count: 28, city: "Nairobi", coords: [-1.2921, 36.8219] }
      ];
      const list = document.getElementById("countryProjectList");
      if (list) list.innerHTML = countryTotals.map((p) =>
        '<li><span class="country-name"><span class="country-flag">' + p.flag + '</span>' + p.country + '</span><strong>' + p.count + '</strong></li>'
      ).join("");
      sampleProjects.forEach((project) => {
        const dot = L.circleMarker(project.coords, {
          radius: 6, color: "#caa2ff", weight: 1.5, fillColor: "#b45cff", fillOpacity: 0.95,
          bubblingMouseEvents: false
        }).addTo(phoenixLeafletMap);
        dot.bindTooltip('<strong>' + project.country + ' · ' + project.count + ' sample projects</strong><br>' + project.city, {
          direction: "top", offset: [0, -7], opacity: 1, className: "project-dot-tooltip"
        });
        dot.on("mouseover", () => dot.setStyle({ radius: 9, color: "#fff0ff", fillColor: "#e4baff", weight: 2 }));
        dot.on("mouseout", () => dot.setStyle({ radius: 6, color: "#caa2ff", fillColor: "#b45cff", weight: 1.5 }));
      });
      const note = document.querySelector(".map-data-note");
      if (note) note.textContent = "Sample locations";
      const status = document.getElementById("mapStatus");
      if (status) status.textContent = "Hover over glowing dots to see sample project counts by location. Country totals are illustrative sample data, not live submissions.";
    }
    requestAnimationFrame(() => phoenixLeafletMap.invalidateSize());
  }
  function renderCommunity() {
    const list = document.getElementById("discussionList");
    if (!list) return;
    const query = (document.getElementById("communitySearch")?.value || "").trim().toLowerCase();
    const visiblePosts = communityPosts.filter((post) => !query || (post.title + " " + post.tag + " " + (post.body || "")).toLowerCase().includes(query));
    list.innerHTML = "";
    visiblePosts.forEach((post) => {
      const item = document.createElement("article");
      item.className = "discussion-card";
      const description = post.body || "Find collaborators, discuss solutions, and link real GitHub issues or pull requests.";
      item.innerHTML = `<div class="discussion-avatar">✦</div><div class="discussion-main"><h3>${escapeHTML(post.title)}</h3><span class="tag">${escapeHTML(post.tag)}</span><p class="muted">${escapeHTML(description)}</p></div><span class="reply-count">▤ ${post.replies}</span>`;
      list.appendChild(item);
    });
    const count = document.getElementById("communityDiscussionCount");
    if (count) count.textContent = String(visiblePosts.length + 839);
    document.querySelectorAll("[data-community-sort]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-community-sort]").forEach((tab) => tab.classList.toggle("selected", tab === button));
      if (button.dataset.communitySort === "helpful") communityPosts.sort((a,b) => b.replies-a.replies);
      else if (button.dataset.communitySort === "hot") communityPosts.sort((a,b) => (b.replies*2 + b.title.length)-(a.replies*2+a.title.length));
      else communityPosts.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
      renderCommunity();
    }));
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function githubWorkUrl(project) {
    const repo = String(project?.repo || "").trim();
    const isSpecificGithubRepo = /^https:\/\/github\.com\/[^/]+\/[^/?#]+(?:[/?#]|$)/i.test(repo) && !/\/topics\//i.test(repo);
    if (isSpecificGithubRepo) return repo;
    return `https://github.com/search?q=${encodeURIComponent(String(project?.name || "open source"))}&type=repositories`;
  }
  function openModal(title, html, wide = false) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalContent").innerHTML = html;
    document.getElementById("modalDialog").classList.toggle("wide", wide);
    document.getElementById("modalBackdrop").hidden = false;
    document.body.classList.add("canvas-protocol-open");
    document.body.style.overflow = "hidden";
    document.getElementById("modalClose").focus();
  }
  function closeModal() {
    document.getElementById("modalBackdrop").hidden = true;
    document.body.classList.remove("canvas-protocol-open");
    document.body.style.overflow = "";
  }
  function openAiAssistant() {
    const panel = document.getElementById("aiAssistantPanel");
    panel.hidden = false;
    document.body.classList.add("canvas-protocol-open");
    document.getElementById("aiAssistantButton").setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      panel.classList.add("is-open");
      document.getElementById("aiAssistantInput").focus();
    });
  }
  function closeAiAssistant() {
    const panel = document.getElementById("aiAssistantPanel");
    panel.classList.remove("is-open");
    panel.hidden = true;
    document.body.classList.remove("canvas-protocol-open");
    document.getElementById("aiAssistantButton").setAttribute("aria-expanded", "false");
    document.getElementById("aiAssistantButton").focus();
  }
  function appendAiMessage(text, role = "bot") {
    const messages = document.getElementById("aiAssistantMessages");
    const message = document.createElement("div");
    message.className = `ai-message ${role}`;
    if (role === "bot") {
      const avatar = document.createElement("span");
      avatar.className = "ai-message-avatar";
      avatar.textContent = "✦";
      message.appendChild(avatar);
    }
    const copy = document.createElement("p");
    copy.textContent = text;
    message.appendChild(copy);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }
  function getAiReply(question) {
    const normalized = question.toLowerCase();
    if (normalized.includes("revive") || normalized.includes("start")) return "Start small: verify the setup instructions, run the core flow, then create a few specific issues with clear acceptance criteria. Ship one small improvement before expanding the scope.";
    if (normalized.includes("feature") || normalized.includes("complete")) return "Pick one high-value, well-scoped improvement first. Write down the expected behavior, add or update a test, and document how another contributor can run it. Save larger features for later milestones.";
    if (normalized.includes("help") || normalized.includes("contribute")) return "A useful first contribution is to document local setup, identify one reproducible issue, and turn the remaining work into small, testable tasks.";
    return "I can help outline a practical revival plan. Ask about the project history, remaining work, or the best next contribution.";
  }
  function submitAiMessage(event) {
    event.preventDefault();
    canvasFeedback("Drag your message card to the Send Message zone to send it.");
  }
  function sendAiMessageFromCanvas(question, inputId = "aiAssistantInput") {
    const clean = String(question || "").trim();
    if (!clean) { canvasFeedback("Type a message first, then drag its card to Send Message.", true); return; }
    appendAiMessage(clean, "user");
    const input = document.getElementById(inputId);
    if (input) input.value = "";
    updateAiMessageDraft();
    window.setTimeout(() => appendAiMessage(getAiReply(clean)), 280);
    canvasFeedback("Message sent to Phoenix AI.");
  }
  function updateAiMessageDraft() {
    const input = document.getElementById("aiAssistantInput");
    const card = document.getElementById("aiMessageDraftCard");
    if (!input || !card) return;
    const message = input.value.trim();
    card.hidden = !message;
    card.draggable = Boolean(message);
    const preview = card.querySelector(".canvas-draft-preview");
    if (preview) preview.textContent = message ? (message.length > 110 ? `${message.slice(0, 107)}…` : message) : "Your message will appear here.";
    card.classList.toggle("is-ready", Boolean(message));
  }
  function openGithubModal() {
    openModal(connected ? "GitHub connected" : "Connect your GitHub", `
      <div class="github-mark">◉</div>
      <h3 style="text-align:center">${connected ? "You're connected in this demo" : "Bring your repositories back to life."}</h3>
      <p class="muted">PHOENIX can use GitHub repository metadata to help you discover inactive projects and plan their revival.</p>
      <ul class="modal-checks"><li>✓ Review repositories before importing</li><li>✓ Choose what you want to publish</li><li>✓ Keep actual code contributions on GitHub</li></ul>
      <div class="notice">This is a demo connection only. Real GitHub OAuth needs a backend callback and secure server-side token storage.</div>
      <article class="canvas-draft-card is-ready" data-drag-type="github-connect" draggable="true"><span class="canvas-card-kicker">GITHUB ACTION CARD</span><strong>${connected ? "Open demo repositories" : "Connect demo GitHub"}</strong><small class="canvas-draft-preview">Drag this card to the Connect zone.</small></article>
      <button class="text-button" id="maybeLater">Maybe later</button>`);
    document.getElementById("maybeLater").addEventListener("click", closeModal);
  }
  function openRepoPicker() {
    openModal("Your GitHub repositories", `
      <p class="muted">Demo repository picker. Real repositories will appear after backend OAuth integration.</p>
      ${[
        ["phoenix-demo / StudySphere","Python · last commit 8 months ago"],
        ["phoenix-demo / EcoTrack","JavaScript · last commit 1 year ago"],
        ["phoenix-demo / PocketForge","TypeScript · last commit 1 year ago"]
      ].map((repo,i) => `<label class="repo-row" data-repo-name="${escapeHTML(repo[0].split(" / ").pop())}" data-repo-description="${escapeHTML(repo[1])}"><input type="checkbox" ${i===0?"checked":""}><span><strong>${repo[0]}</strong><small>${repo[1]}</small></span><span class="tag">Public demo</span></label>`).join("")}
      <article class="canvas-draft-card is-ready" data-drag-type="github-import" draggable="true"><span class="canvas-card-kicker">REPOSITORY BATCH</span><strong>Import selected demo repositories</strong><small class="canvas-draft-preview">Select repositories above, then drag this card to Import.</small></article>`);
  }
  function openAddProject() {
    openModal("Submit a project", `
      <p class="muted">Share a project and its public location. Submissions are reviewed before appearing on the public map.</p>
      <form id="newProjectForm">
        <label class="field-label">Project name<input name="name" required maxlength="100" placeholder="e.g. OpenStudy"></label>
        <label class="field-label">Project details<textarea name="description" rows="3" maxlength="2000" required placeholder="What does it do, and what help is needed?"></textarea></label>
        <label class="field-label">City / region<input name="city" required maxlength="120" placeholder="e.g. Bengaluru, India"></label>
        <div class="form-grid-two">
          <label class="field-label">Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required placeholder="12.9716"></label>
          <label class="field-label">Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required placeholder="77.5946"></label>
        </div>
        <label class="field-label">Public project URL (optional)<input name="repository_url" type="url" maxlength="500" placeholder="https://github.com/…"></label>
        <article class="canvas-draft-card" id="newProjectDraftCard" data-drag-type="new-project" data-form-id="newProjectForm" draggable="false"><span class="canvas-card-kicker">PROJECT SUBMISSION CARD</span><strong>Complete the required fields</strong><small class="canvas-draft-preview">The card unlocks when your project details and coordinates are valid.</small></article>
        <p class="canvas-inline-hint">Drag the completed card to Add Project to submit it for review.</p>
        <p class="tiny-note">Use approximate city coordinates; do not submit a private home address. Without Supabase, submissions stay in this browser’s demo archive.</p>
      </form>`);
    const newProjectForm = document.getElementById("newProjectForm");
    newProjectForm.addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the project submission card to Add Project."); });
    newProjectForm.addEventListener("input", updateNewProjectDraftCard);
    updateNewProjectDraftCard();
  }
  function openProjectDetails(id) {
    setPage("Project Tombstone", false, id);
  }
  function renderProjectDetail() {
    const p = selectedProject;
    if (!p) return;
    const votes = getProjectVotes(p.id);
    const chance = ({ 1: "72%", 2: "68%", 3: "64%", 4: "61%" })[p.id] || "70%";
    const content = document.getElementById("projectDetailContent");
    content.innerHTML = `
      <article class="tombstone-detail-card" data-project-status="${escapeHTML(p.status)}">
        <div class="detail-tomb-wrap">
          <img src="assets/graveyard-reference/tombstone-background.jpg" alt="${escapeHTML(p.name)} tombstone in a candlelit graveyard">
          <div class="detail-tomb-engraving">
            <small>PROJECT ARCHIVE</small>
            <strong>${escapeHTML(p.name)}</strong>
            <dl>
              <div><dt>Born</dt><dd>Jan 12, 2024</dd></div>
              <div><dt>Last Commit</dt><dd>${escapeHTML(p.lastCommit)}</dd></div>
              <div><dt>Cause of Death</dt><dd>Feature Creep</dd></div>
              <div><dt>Revival Chance</dt><dd class="chance">${chance}</dd></div>
            </dl>
          </div>
          <div class="detail-tomb-counts"><span>♥ ${votes.likes}</span><span>★ ${p.stars}</span><span>✦ 14</span></div>
        </div>
        <section class="detail-project-main">
          <div class="detail-project-heading">
            <div><h1>${escapeHTML(p.name)}</h1><p>${escapeHTML(p.description)}</p></div>
          </div>
          ${p.status === "Hall of Fame" ? `<a class="start-working-button hall-detail-start-working" href="${escapeHTML(githubWorkUrl(p))}" target="_blank" rel="noopener noreferrer">Start Working <span aria-hidden="true">↗</span></a>` : `<div class="canvas-project-card" draggable="true" data-drag-type="project" data-project-id="${p.id}"><span class="canvas-card-kicker">PROJECT DATA CARD</span><strong>${escapeHTML(p.name)}</strong><small>Drag to Revive, Support or Needs Work.</small></div>`}
          <div class="detail-badges"><span class="tag">${escapeHTML(p.language)}</span>${p.needs.slice(0,2).map((need) => `<span class="tag">${escapeHTML(need)}</span>`).join("")}</div>
          <div class="detail-actions-row">
            <a class="detail-mini-action" href="${escapeHTML(p.repo)}" target="_blank" rel="noreferrer">★ Star on GitHub (${votes.likes})</a>
            <a class="detail-mini-action" href="${escapeHTML(p.repo)}" target="_blank" rel="noreferrer">⑂ Open repository ↗</a>
            ${p.status !== "Hall of Fame" ? `<a class="start-working-button detail-start-working" href="${escapeHTML(githubWorkUrl(p))}" target="_blank" rel="noopener noreferrer">Start Working <span aria-hidden="true">↗</span></a>` : ""}
            <div class="canvas-flower-card" draggable="true" data-drag-type="flower-tribute" data-project-id="${p.id}"><span>✿</span><strong>Flower tribute</strong><small>Drag to Leave Flower</small><em id="detailFlowerCount">${flowerCounts[p.id] || 12} flowers</em></div>
          </div>
          <nav class="detail-tabs" aria-label="Project detail sections">
            <button class="detail-tab active" type="button" data-detail-tab="overview">Overview</button>
            <button class="detail-tab" type="button" data-detail-tab="files">Files</button>
            ${p.status !== "Hall of Fame" ? '<button class="detail-tab" type="button" data-detail-tab="analysis">AI Analysis</button><button class="detail-tab" type="button" data-detail-tab="diary">Grave Diary</button>' : ""}
            <button class="detail-tab" type="button" data-detail-tab="discussion">Discussion</button>
          </nav>
          <div class="detail-tab-content" id="detailTabContent"></div>
        </section>
      </article>`;
    const tabPanel = document.getElementById("detailTabContent");
    const showDetailTab = (tab) => {
      const tabContent = {
        overview: `<article class="detail-about panel"><h3>About</h3><p>${escapeHTML(p.description)} Built with ${escapeHTML(p.language)}, this project needs a focused first contribution and a fresh project plan.</p><button class="detail-read-more" type="button">Read more →</button></article><aside class="detail-contributors panel"><h3>Contributors (3)</h3><div class="contributor"><span>SV</span><b>suhaniverma</b><small>Owner</small></div><div class="contributor"><span>DV</span><b>devnish</b><small>Contributor</small></div><div class="contributor"><span>PC</span><b>priya_codes</b><small>Contributor</small></div></aside>`,
        files: `<article class="detail-about panel"><h3>Project files</h3><p class="muted">Repository structure is ready for its next contributor.</p><ul class="detail-file-list"><li>src/ <span>Core source</span></li><li>README.md <span>Needs refresh</span></li><li>package.json <span>Dependencies</span></li></ul></article>`,
        analysis: `<article class="detail-about panel"><h3>AI analysis</h3><p>Most useful next step: restore the setup instructions, validate the core flow, then split the remaining work into small issues.</p><div class="analysis-score"><span>Revival chance</span><b>${chance}</b></div></article>`,
        diary: `<article class="detail-about panel"><h3>Grave diary</h3><p><b>Last commit:</b> ${escapeHTML(p.lastCommit)}</p><p class="muted">The project was archived after scope expanded faster than the contributor time available.</p></article>`,
        discussion: `<article class="detail-about panel"><h3>Discussion</h3><p>Be the first person to leave a practical revival note for this project.</p><article class="canvas-draft-card is-ready" draggable="true" data-drag-type="project-discussion" data-project-id="${p.id}" data-project-name="${escapeHTML(p.name)}"><span class="canvas-card-kicker">DISCUSSION CARD</span><strong>Start a discussion</strong><small class="canvas-draft-preview">Drag to Publish to add a project discussion to Community.</small></article></article>`
      };
      tabPanel.innerHTML = tabContent[tab] || tabContent.overview;
      document.querySelectorAll(".detail-tab").forEach((button) => button.classList.toggle("active", button.dataset.detailTab === tab));
    };
    document.querySelectorAll(".detail-tab").forEach((button) => button.addEventListener("click", () => showDetailTab(button.dataset.detailTab)));
    showDetailTab("overview");
  }
  function statusClass(status) { return status.toLowerCase().replaceAll(" ", "-"); }

  // Older shared links used #landing, which makes the browser jump past the
  // cinematic section before the animation has a chance to play. Treat that
  // anchor as the beginning of Home so the 116-frame scroll intro always
  // starts from frame one.
  if (window.location.hash === "#landing") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
  window.addEventListener("hashchange", () => setPage(resolvePageFromHash(), true));
  const initialPage = resolvePageFromHash();
  if (initialPage !== "Home") setPage(initialPage, true);
  document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => setPage(button.dataset.page)));
  document.querySelectorAll(".filter-tab").forEach((button) => button.addEventListener("click", () => { currentFilter = button.dataset.filter; setPage(currentFilter); }));
  const navSearchInput = document.getElementById("searchInput");
  if (navSearchInput) navSearchInput.addEventListener("input", renderProjects);
  document.getElementById("graveyardSearch").addEventListener("input", renderProjects);
  document.getElementById("graveyardSort").addEventListener("change", renderProjects);
  document.getElementById("memorialSearch").addEventListener("input", renderMemorialGarden);
  document.getElementById("memorialSort").addEventListener("change", renderMemorialGarden);
  document.getElementById("hallSearch").addEventListener("input", renderHallOfFame);
  document.getElementById("hallSort").addEventListener("change", renderHallOfFame);
  document.querySelectorAll(".hall-category").forEach((button) => button.addEventListener("click", () => {
    hallCategory = button.dataset.hallCategory;
    document.querySelectorAll(".hall-category").forEach((item) => item.classList.toggle("selected", item === button));
    renderHallOfFame();
  }));
  document.getElementById("toggleFilters").addEventListener("click", () => {
    const open = document.body.classList.toggle("filters-open");
    document.getElementById("toggleFilters").setAttribute("aria-expanded", open);
  });
  document.getElementById("languageFilter").addEventListener("change", renderProjects);
  const profileButton = document.getElementById("profileButton");
  const profileButtonAvatar = document.getElementById("profileButtonAvatar");
  const profileDropdown = document.getElementById("profileDropdown");
  const profileMenuAvatar = document.getElementById("profileMenuAvatar");
  const profileMenuName = document.getElementById("profileMenuName");
  const profileConnectionStatus = document.getElementById("profileConnectionStatus");
  const profileGithubAction = document.getElementById("profileGithubAction");
  const profileGithubActionDetail = document.getElementById("profileGithubActionDetail");
  function safeProfileName(value) {
    return String(value || defaultProfile.displayName).trim().replace(/\s+/g, " ").slice(0, 36) || defaultProfile.displayName;
  }
  function safeProfileAvatar(value) {
    return String(value || defaultProfile.avatar).trim().slice(0, 12) || defaultProfile.avatar;
  }
  function saveProfile() {
    profile.displayName = safeProfileName(profile.displayName);
    profile.avatar = safeProfileAvatar(profile.avatar);
    profile.bio = String(profile.bio || "").trim().slice(0, 180) || defaultProfile.bio;
    profile.notifications = profile.notifications !== false;
    try { localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile)); } catch (_) {}
    syncProfileMenu();
  }
  function setGithubConnection(value) {
    connected = Boolean(value);
    try { localStorage.setItem(GITHUB_CONNECTION_KEY, String(connected)); } catch (_) {}
    syncProfileMenu();
  }
  function setProfileMenu(open) {
    profileDropdown.hidden = !open;
    profileButton.setAttribute("aria-expanded", String(open));
  }
  function syncProfileMenu() {
    profileConnectionStatus.textContent = connected ? "GitHub demo connected" : "Demo account · Not connected";
    profileGithubAction.textContent = connected ? "GitHub repositories" : "Connect GitHub";
    profileGithubActionDetail.textContent = connected ? "Browse imported demo projects" : "Demo connection";
    const displayName = safeProfileName(profile.displayName);
    const avatar = safeProfileAvatar(profile.avatar);
    profileButtonAvatar.textContent = avatar;
    profileMenuAvatar.textContent = avatar;
    profileMenuName.textContent = displayName.toUpperCase();
    profileButton.setAttribute("aria-label", `Open ${displayName}'s profile menu`);
  }
  function getProfileVotes() {
    return projects.map((project) => ({ project, vote: getProjectVotes(project.id) })).filter((entry) => entry.vote.vote);
  }
  function getSavedProjects() {
    return getProfileVotes().filter(({ vote }) => vote.vote === "like").map(({ project }) => project);
  }
  function profileProjectRows(items, emptyText) {
    if (!items.length) return `<p class="muted profile-empty-state">${escapeHTML(emptyText)}</p>`;
    return `<div class="profile-project-list">${items.map((project) => `
      <article class="profile-project-row">
        <div><strong>${escapeHTML(project.name)}</strong><p>${escapeHTML(project.language)} · ${escapeHTML(project.status)}</p></div>
        <button type="button" class="button button-secondary small" data-profile-open-project="${project.id}">View</button>
      </article>`).join("")}</div>`;
  }
  function bindProfileProjectButtons() {
    document.querySelectorAll("[data-profile-open-project]").forEach((button) => button.addEventListener("click", () => {
      const project = projects.find((entry) => entry.id === Number(button.dataset.profileOpenProject));
      if (project) { closeModal(); openProjectDetails(project.id); }
    }));
  }
  function openProfileEditor() {
    openModal("Edit profile", `
      <form class="profile-form" id="profileEditForm">
        <label class="field-label">Display name<input name="displayName" maxlength="36" required value="${escapeHTML(safeProfileName(profile.displayName))}"></label>
        <label class="field-label">Avatar emoji<input name="avatar" maxlength="12" value="${escapeHTML(safeProfileAvatar(profile.avatar))}" aria-describedby="profileAvatarHint"></label>
        <p class="tiny-note" id="profileAvatarHint">Use one emoji, such as ✦, 🔥, 🌙, or 👤.</p>
        <label class="field-label">Short bio<textarea name="bio" rows="4" maxlength="180">${escapeHTML(profile.bio || defaultProfile.bio)}</textarea></label>
        <article class="canvas-draft-card is-ready" data-drag-type="profile-save" data-form-id="profileEditForm" draggable="true"><span class="canvas-card-kicker">PROFILE CHANGES</span><strong>Save profile changes</strong><small class="canvas-draft-preview">Drag this card to Save.</small></article>
        <p class="canvas-inline-hint">Your edits stay as a draft until you drop this card on Save.</p>
      </form>`);
    document.getElementById("profileEditForm").addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the profile changes card to Save."); });
  }
  function openProfileOverview() {
    const savedProjects = getSavedProjects();
    const activity = getProfileVotes();
    const shipped = projects.filter((project) => project.status === "Memorial Garden" || project.status === "Hall of Fame").length;
    openModal("My Profile", `
      <section class="profile-overview">
        <div class="profile-overview-hero">
          <span class="profile-large-avatar" aria-hidden="true">${escapeHTML(safeProfileAvatar(profile.avatar))}</span>
          <div><p class="profile-overline">PHOENIX MEMBER</p><h3>${escapeHTML(safeProfileName(profile.displayName))}</h3><span class="profile-connection-chip">${connected ? "● GitHub demo connected" : "○ Demo account"}</span></div>
          <button class="button button-secondary small profile-edit-button" type="button" id="editProfileButton">Edit profile</button>
        </div>
        <p class="profile-bio">${escapeHTML(profile.bio || defaultProfile.bio)}</p>
        <div class="profile-stat-grid">
          <div><strong>${savedProjects.length}</strong><span>Saved projects</span></div>
          <div><strong>${activity.length}</strong><span>Votes cast</span></div>
          <div><strong>${shipped}</strong><span>Revived / launched</span></div>
        </div>
        <div class="profile-quick-actions">
          <button type="button" data-profile-overview-action="saved">♡ Saved projects</button>
          <button type="button" data-profile-overview-action="activity">↗ Activity</button>
          <button type="button" data-profile-overview-action="repositories">⌘ Repositories</button>
          <button type="button" data-profile-overview-action="settings">⚙ Settings</button>
        </div>
        ${connected ? '<article class="canvas-draft-card is-ready" data-drag-type="github-disconnect" draggable="true"><span class="canvas-card-kicker">GITHUB ACTION CARD</span><strong>Disconnect demo GitHub</strong><small class="canvas-draft-preview">Drag this card to Connect.</small></article>' : ""}
      </section>`);
    document.getElementById("editProfileButton").addEventListener("click", openProfileEditor);
    document.querySelectorAll("[data-profile-overview-action]").forEach((button) => button.addEventListener("click", () => {
      ({ saved: openSavedProjects, activity: openProfileActivity, repositories: () => connected ? openRepoPicker() : openGithubModal(), settings: openProfileSettings }[button.dataset.profileOverviewAction])();
    }));
  }
  function openSavedProjects() {
    openModal("Saved Projects", profileProjectRows(getSavedProjects(), "Like a project in the Graveyard to save it here."), true);
    bindProfileProjectButtons();
  }
  function openProfileActivity() {
    const activity = getProfileVotes();
    const html = activity.length ? `<div class="profile-project-list">${activity.map(({ project, vote }) => `
      <article class="profile-project-row">
        <div><strong>${escapeHTML(project.name)}</strong><p>${vote.vote === "like" ? "♥ Liked" : "▾ Disliked"} · ${escapeHTML(project.status)}</p></div>
        <button type="button" class="button button-secondary small" data-profile-open-project="${project.id}">View</button>
      </article>`).join("")}</div>` : `<p class="muted profile-empty-state">Vote on a project in the Graveyard and your activity will appear here.</p>`;
    openModal("My Activity", html, true);
    bindProfileProjectButtons();
  }
  function openProfileNotifications() {
    openModal("Notifications", `
      <form class="profile-form" id="profileNotificationsForm">
        <p class="muted">Choose whether Phoenix can show your saved activity and revival reminders on this device.</p>
        <label class="profile-toggle"><input name="notifications" type="checkbox" ${profile.notifications ? "checked" : ""}><span>Enable Phoenix updates</span></label>
        <article class="canvas-draft-card is-ready" data-drag-type="notifications-save" data-form-id="profileNotificationsForm" draggable="true"><span class="canvas-card-kicker">NOTIFICATION SETTINGS</span><strong>Save notification settings</strong><small class="canvas-draft-preview">Drag this card to Save.</small></article>
        <p class="tiny-note" id="profileNotificationStatus" role="status">Settings are not applied until the card is dropped.</p>
      </form>`);
    document.getElementById("profileNotificationsForm").addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the notification settings card to Save."); });
  }
  function openProfileSettings() {
    const motionSaved = localStorage.getItem("phoenix-reduce-motion") === "true";
    openModal("Settings", `
      <form class="profile-form" id="profileSettingsForm">
        <h3>Appearance</h3>
        <label class="profile-toggle"><input name="reduceMotion" type="checkbox" ${motionSaved ? "checked" : ""}><span>Reduce animations and motion</span></label>
        <label class="profile-toggle"><input name="notifications" type="checkbox" ${profile.notifications ? "checked" : ""}><span>Enable Phoenix updates</span></label>
        <article class="canvas-draft-card is-ready" data-drag-type="settings-save" data-form-id="profileSettingsForm" draggable="true"><span class="canvas-card-kicker">PREFERENCES</span><strong>Apply preferences</strong><small class="canvas-draft-preview">Drag this card to Save.</small></article>
        <p class="tiny-note" id="profileSettingsStatus" role="status">Preferences remain a draft until dropped on Save.</p>
      </form>`);
    document.getElementById("profileSettingsForm").addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the preferences card to Save."); });
  }
  function openProfileHelp() {
    openModal("Help & Support", `
      <section class="profile-help">
        <h3>Explore Phoenix</h3>
        <p class="muted">Discover abandoned projects, support revivals, and keep track of ideas that have returned to life.</p>
        <div class="profile-quick-actions">
          <button type="button" data-profile-help-page="Graveyard">Visit Graveyard</button>
          <button type="button" data-profile-help-page="Memorial Garden">Visit Memorial Garden</button>
          <button type="button" data-profile-help-page="Hall of Fame">Visit Hall of Fame</button>
          <button type="button" data-profile-help-page="World Cemetery">Open Map</button>
        </div>
        <a class="profile-support-link" href="https://github.com/SuhaniSV/PhoenixNEW" target="_blank" rel="noopener noreferrer">Open Phoenix repository ↗</a>
      </section>`);
    document.querySelectorAll("[data-profile-help-page]").forEach((button) => button.addEventListener("click", () => {
      closeModal();
      setPage(button.dataset.profileHelpPage);
    }));
  }
  syncProfileMenu();
  document.documentElement.classList.toggle("phoenix-reduce-motion", localStorage.getItem("phoenix-reduce-motion") === "true");
  profileButton.addEventListener("click", () => {
    syncProfileMenu();
    setProfileMenu(profileDropdown.hidden);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest("#profileMenuWrap")) setProfileMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !profileDropdown.hidden) {
      setProfileMenu(false);
      profileButton.focus();
    }
  });
  profileDropdown.addEventListener("click", (event) => {
    const item = event.target.closest("[data-profile-action]");
    if (!item) return;
    const action = item.dataset.profileAction;
    setProfileMenu(false);
    if (action === "github" || action === "repositories") {
      connected ? openRepoPicker() : openGithubModal();
      return;
    }
    ({ profile: openProfileOverview, saved: openSavedProjects, activity: openProfileActivity, notifications: openProfileNotifications, settings: openProfileSettings, help: openProfileHelp }[action] || (() => {}))();
  });
  document.getElementById("aiAssistantButton").addEventListener("click", openAiAssistant);
  document.getElementById("aiAssistantClose").addEventListener("click", closeAiAssistant);
  document.getElementById("aiAssistantForm").addEventListener("submit", submitAiMessage);
  document.getElementById("importReposButton").addEventListener("click", connected ? openRepoPicker : openGithubModal);
  document.getElementById("addProjectButton").addEventListener("click", openAddProject);
  skipIntro.addEventListener("click", skipIntroSequence);
  // Do not auto-skip the intro on a timer: the sequence is scroll-driven and
  // should remain on its opening frame until the visitor scrolls or skips it.
  // startFrameLoading() releases the loading lock after frame 1 loads (or its
  // timeout expires), and the visible Skip Intro button remains available.

  document.getElementById("brandHome").addEventListener("click", (event) => { event.preventDefault(); currentFilter = "Home"; setPage("Home"); });
  document.getElementById("backToGraveyard").addEventListener("click", () => setPage("Graveyard"));
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("mousedown", (event) => { if (event.target.id === "modalBackdrop") closeModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  document.getElementById("communityForm").addEventListener("submit", (event) => { event.preventDefault(); canvasFeedback("Drag the community draft card to Publish."); });
  initCanvasProtocol();
  document.querySelectorAll("[data-community-action]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.communityAction;
    if (action === "ask") document.getElementById("communityTopic")?.focus();
    else if (action === "ideas") { const category = document.getElementById("communityCategory"); if (category) category.value = "Ideas"; document.getElementById("communityTopic")?.focus(); }
    else if (action === "help") { const category = document.getElementById("communityCategory"); if (category) category.value = "Community"; document.getElementById("communitySearch")?.focus(); }
    else if (action === "collaborate") { const category = document.getElementById("communityCategory"); if (category) category.value = "Open Source"; document.getElementById("communityTopic")?.focus(); }
    else if (action === "grow") document.querySelector(".community-more")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  const communitySearch = document.getElementById("communitySearch");
  if (communitySearch) communitySearch.addEventListener("input", renderCommunity);
  // Landing reveal is handled in updateScroll() once the intro has fully left view.

  // Lenis already reports scroll updates above; attach the native listener only
  // when its CDN is unavailable so we do not schedule duplicate canvas redraws.
  if (!lenis) window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", () => { lastDrawn = -1; scheduleDraw(); updateScroll(); if (phoenixLeafletMap) phoenixLeafletMap.invalidateSize(); });
  renderProjects(); renderCommunity(); renderMapPins(); updateScroll(); startFrameLoading();
})();
