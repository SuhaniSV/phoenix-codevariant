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
    { id: 3, name: "MediScan AI", description: "An experimental medical-image analysis project seeking documentation and model evaluation.", language: "Python", lastCommit: "2 years ago", status: "Under Revival", stars: 76, needs: ["ML", "Documentation"], repo: "https://github.com/topics/machine-learning" },
    { id: 4, name: "TaskFlow", description: "A focused task manager that returned with a simpler workflow and fresh release notes.", language: "JavaScript", lastCommit: "2 months ago", status: "Memorial Garden", stars: 124, needs: ["UI/UX", "Testing"], repo: "https://github.com/topics/task-management", revived: "Revived 2 months ago", gardenTech: "Next.js", gardenArt: "taskflow" },
    { id: 7, name: "GreenCart", description: "A sustainable shopping planner revived with a cleaner catalogue and green delivery ideas.", language: "React", lastCommit: "3 months ago", status: "Memorial Garden", stars: 98, needs: ["Design", "Testing"], repo: "https://github.com/topics/sustainability", revived: "Revived 3 months ago", gardenTech: "React", gardenArt: "greencart" },
    { id: 8, name: "Eventify", description: "An event planning project brought back with a polished discovery flow and live community calendar.", language: "Python", lastCommit: "1 month ago", status: "Memorial Garden", stars: 76, needs: ["Backend", "Documentation"], repo: "https://github.com/topics/event-management", revived: "Revived 1 month ago", gardenTech: "Django", gardenArt: "eventify" },
    { id: 9, name: "HealthMate", description: "A wellbeing companion revived with daily check-ins and a calmer, accessible mobile experience.", language: "Dart", lastCommit: "4 months ago", status: "Memorial Garden", stars: 88, needs: ["Mobile", "Accessibility"], repo: "https://github.com/topics/health-app", revived: "Revived 4 months ago", gardenTech: "Flutter", gardenArt: "healthmate" },
    { id: 5, name: "MediScan AI", description: "An AI-assisted imaging workspace that launched with a clear review flow and clinician dashboard.", language: "Python", lastCommit: "2 months ago", status: "Hall of Fame", stars: 124, needs: ["AI", "Healthcare"], repo: "https://github.com/topics/machine-learning", hallLaunch: "Launched 2 months ago", hallRank: 2, hallSignals: 32, hallArt: "mediscan", hallCategories: ["web", "featured"] },
    { id: 6, name: "CampusConnect", description: "A community platform that launched with campus groups, events, and a contribution guide.", language: "Java", lastCommit: "3 months ago", status: "Hall of Fame", stars: 98, needs: ["Backend", "Community"], repo: "https://github.com/topics/campus", hallLaunch: "Launched 3 months ago", hallRank: 3, hallSignals: 21, hallArt: "campus", hallCategories: ["mobile", "open-source", "featured"] }
  ];
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

    const firstFrameTimeout = new Promise((resolve) => window.setTimeout(() => resolve(false), 3500));
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
    "Under Revival": "Projects with active adoption or linked contribution work.",
    "Memorial Garden": "Projects that have reached an agreed revival milestone.",
    "Hall of Fame": "Projects with a verified release, deployment, or public outcome.",
    Community: "Ask for help, share knowledge, and find collaborators.",
    "World Cemetery": "Explore project locations shared voluntarily by their owners."
  };
  const pageRoutes = { Home: "landing", Graveyard: "graveyard", "Under Revival": "under-revival", "Memorial Garden": "memorial-garden", "Hall of Fame": "hall-of-fame", "World Cemetery": "map", Community: "community", "Project Tombstone": "tombstone" };
  function getRouteDetails() {
    const route = window.location.hash.replace(/^#/, "") || "landing";
    const tombstoneMatch = route.match(/^tombstone-(\d+)$/);
    if (tombstoneMatch) return { page: "Project Tombstone", projectId: Number(tombstoneMatch[1]) };
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
      const aiPanel = document.getElementById("aiAssistantPanel");
      if (aiPanel && !aiPanel.hidden) {
        aiPanel.hidden = true;
        aiPanel.classList.remove("is-open");
        document.getElementById("aiAssistantButton").setAttribute("aria-expanded", "false");
      }
    }
    if (["Home", "Graveyard", "Under Revival", "Memorial Garden", "Hall of Fame"].includes(page)) currentFilter = page;
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
          ${currentFilter === "Graveyard" ? `<div class="vote-actions" aria-label="Rate ${escapeHTML(project.name)}"><button class="vote-button like" type="button" aria-pressed="false" aria-label="Like project">♥ <span class="vote-count">0</span></button><button class="vote-button dislike" type="button" aria-pressed="false" aria-label="Dislike project">▾ <span class="vote-count">0</span></button><button class="card-action" type="button">View tombstone <span>↗</span></button></div>` : `<button class="card-action" type="button">View tombstone <span>↗</span></button>`}
        </div>`;
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
        const votes = getProjectVotes(project.id);
        const like = card.querySelector(".vote-button.like"), dislike = card.querySelector(".vote-button.dislike");
        like.querySelector(".vote-count").textContent = votes.likes;
        dislike.querySelector(".vote-count").textContent = votes.dislikes;
        like.setAttribute("aria-pressed", votes.vote === "like");
        dislike.setAttribute("aria-pressed", votes.vote === "dislike");
        like.addEventListener("click", () => voteForProject(project.id, "like"));
        dislike.addEventListener("click", () => voteForProject(project.id, "dislike"));
      }
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
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Open ${project.name}`);
      card.innerHTML = `
        <div class="memorial-art"><img src="assets/memorial-garden/${escapeHTML(project.gardenArt || "taskflow")}.webp" alt="${escapeHTML(project.name)} revived project garden"></div>
        <div class="memorial-card-copy"><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.revived || "Recently revived")}</p><span>${escapeHTML(project.gardenTech || project.language)}</span></div>`;
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
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Open ${project.name}`);
      card.innerHTML = `
        <div class="hall-art hall-art-${escapeHTML(project.hallArt || "mediscan")}" aria-hidden="true"><span class="hall-art-glow"></span><span class="hall-art-title">${escapeHTML(project.language)}</span></div>
        <div class="hall-card-copy"><h3>${escapeHTML(project.name)}</h3><p>${escapeHTML(project.hallLaunch || "Recently launched")}</p><div class="hall-stats"><span>★ ${project.stars}</span><span>✦ ${project.hallSignals || 0}</span></div></div>`;
      const open = () => openProjectDetails(project.id);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
      grid.appendChild(card);
    });
  }