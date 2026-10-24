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