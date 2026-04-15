/* ============================================
   NEWS TABLOID NOW - Main JavaScript
   Scrapbook Chaos Engine
   ============================================ */

(function () {
  'use strict';

  var ANIM_CLASSES = ['anim-slam', 'anim-fly-left', 'anim-fly-right', 'anim-fly-bottom', 'anim-pop'];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ============================================
     SEEDED RANDOM (deterministic per page load
     so layout doesn't jump on resize)
     ============================================ */
  var _seed = Date.now() % 10000;
  function seededRandom() {
    _seed = (_seed * 16807 + 0) % 2147483647;
    return (_seed & 0x7fffffff) / 2147483647;
  }
  function randRange(min, max) { return min + seededRandom() * (max - min); }
  function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }
  function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

  /* ============================================
     GENERATE UNIQUE TORN EDGE CLIP-PATHS
     Each clipping gets a completely unique tear
     ============================================ */
  function generateTornClipPath() {
    // Top edge - random jagged tears
    var top = [];
    var steps = randInt(18, 30);
    for (var i = 0; i <= steps; i++) {
      var x = (i / steps) * 100;
      var y = i === 0 || i === steps ? randRange(0, 2) : randRange(0, 4.5);
      top.push(x.toFixed(1) + '% ' + y.toFixed(1) + '%');
    }

    // Right edge
    var right = [];
    var rSteps = randInt(8, 14);
    for (var j = 0; j <= rSteps; j++) {
      var ry = (j / rSteps) * 100;
      var rx = 100 - randRange(0, 2.5);
      right.push(rx.toFixed(1) + '% ' + ry.toFixed(1) + '%');
    }

    // Bottom edge (reversed)
    var bottom = [];
    var bSteps = randInt(18, 30);
    for (var k = bSteps; k >= 0; k--) {
      var bx = (k / bSteps) * 100;
      var by = 100 - randRange(0, 4.5);
      bottom.push(bx.toFixed(1) + '% ' + by.toFixed(1) + '%');
    }

    // Left edge (reversed)
    var left = [];
    var lSteps = randInt(8, 14);
    for (var l = lSteps; l >= 0; l--) {
      var ly = (l / lSteps) * 100;
      var lx = randRange(0, 2.5);
      left.push(lx.toFixed(1) + '% ' + ly.toFixed(1) + '%');
    }

    return 'polygon(' + top.concat(right.slice(1), bottom.slice(1), left.slice(1)).join(', ') + ')';
  }

  /* ============================================
     PAPER COLORS - 10 varieties
     ============================================ */
  var PAPERS = [
    '#F5F0E4',  // standard cream
    '#EDE8D8',  // warm cream
    '#F0EBE0',  // light parchment
    '#E8E2D0',  // deeply aged
    '#FAF7F0',  // nearly white (fresh)
    '#E5DFD0',  // very aged
    '#F2EDE2',  // cool cream
    '#E0D8C4',  // brown-ish aged
    '#FBF8F2',  // bright white newsprint
    '#DDD6C2',  // old manila
  ];

  /* ============================================
     DECORATION CONFIGS
     ============================================ */
  var TAPE_COLORS = [
    'rgba(255, 255, 220, 0.5)',
    'rgba(255, 255, 200, 0.45)',
    'rgba(240, 240, 210, 0.55)',
    'rgba(255, 250, 230, 0.4)',
    'rgba(220, 220, 200, 0.5)',  // aged/grey tape
  ];

  var PIN_COLORS = ['pin-red', 'pin-yellow', 'pin-blue', 'pin-green'];

  /* ============================================
     RANDOMIZE ALL CLIPPINGS
     Core function: makes each one unique
     ============================================ */
  function randomizeClippings() {
    var clippings = document.querySelectorAll('.clipping');
    var isMobile = window.innerWidth < 680;

    clippings.forEach(function (clip) {
      // Skip article page main clipping (keep it readable)
      var isArticlePage = clip.classList.contains('clipping--article');

      // 1. UNIQUE TORN EDGES
      clip.style.clipPath = generateTornClipPath();
      clip.style.webkitClipPath = clip.style.clipPath;

      // 2. RANDOM ROTATION
      var maxRot = isArticlePage ? 0.8 : (isMobile ? 2.5 : 4.5);
      var rotation = randRange(-maxRot, maxRot);
      clip.style.setProperty('--rotation', rotation.toFixed(2) + 'deg');

      // 3. RANDOM PAPER COLOR
      clip.style.setProperty('--paper-bg', pick(PAPERS));
      clip.style.background = 'var(--paper-bg)';

      // 4. RANDOM DECORATIONS (30% tape, 20% pin, 15% stain, 15% fold, 10% yellowed)
      var roll = seededRandom();

      if (roll < 0.30) {
        // TAPE
        clip.classList.add('has-tape');
        clip.style.setProperty('--tape-top', randRange(-8, -3) + 'px');
        if (seededRandom() > 0.5) {
          clip.style.setProperty('--tape-left', randRange(15, 60) + '%');
          clip.style.setProperty('--tape-right', 'auto');
        } else {
          clip.style.setProperty('--tape-right', randRange(10, 50) + '%');
          clip.style.setProperty('--tape-left', 'auto');
        }
        clip.style.setProperty('--tape-width', randRange(55, 100) + 'px');
        clip.style.setProperty('--tape-height', randRange(18, 28) + 'px');
        clip.style.setProperty('--tape-color', pick(TAPE_COLORS));
        clip.style.setProperty('--tape-angle', randRange(-6, 6) + 'deg');
      } else if (roll < 0.50) {
        // PIN
        clip.classList.add('has-pin');
        clip.classList.add(pick(PIN_COLORS));
        clip.style.setProperty('--pin-top', randRange(6, 18) + 'px');
        clip.style.setProperty('--pin-left', randRange(30, 70) + '%');
        clip.style.setProperty('--pin-size', randRange(12, 18) + 'px');
      } else if (roll < 0.65) {
        // COFFEE STAIN
        clip.classList.add('has-stain');
        clip.style.setProperty('--stain-bottom', randRange(5, 30) + '%');
        clip.style.setProperty('--stain-right', randRange(5, 30) + '%');
        clip.style.setProperty('--stain-size', randRange(50, 110) + 'px');
        clip.style.setProperty('--stain-angle', randRange(0, 360) + 'deg');
      } else if (roll < 0.80) {
        // FOLD LINE
        clip.classList.add('has-fold');
        clip.style.setProperty('--fold-angle', randRange(110, 160) + 'deg');
      } else if (roll < 0.90) {
        // YELLOWED EDGES
        clip.classList.add('has-yellowed');
      }
      // 10% get no decoration (clean clipping)

      // 5. SLIGHT RANDOM OFFSET for organic placement
      if (!isArticlePage && !isMobile) {
        var xOffset = randRange(-8, 8);
        var yOffset = randRange(-5, 5);
        clip.parentElement.style.transform = 'translate(' + xOffset + 'px, ' + yOffset + 'px)';
      }
    });
  }

  /* ============================================
     SCROLL ANIMATIONS
     ============================================ */
  function initScrollAnimations() {
    var targets = document.querySelectorAll(
      '.clipping-wrapper, .clipping-wrapper--related, .breaking-wrapper, .newsletter-wrapper, ' +
      '.about-intro-wrapper, .team-clipping-wrapper, .contact-wrapper, .disclaimer-wrapper'
    );

    if (!targets.length) return;

    if (!prefersReducedMotion()) {
      targets.forEach(function (el, i) {
        var animIndex = randInt(0, ANIM_CLASSES.length - 1);
        el.classList.add(ANIM_CLASSES[animIndex]);
        el.style.animationDelay = (i * 0.1 + seededRandom() * 0.15) + 's';
      });
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

      targets.forEach(function (el) { observer.observe(el); });
    } else {
      targets.forEach(function (el) { el.classList.add('in-view'); });
    }
  }

  /* ============================================
     MOBILE MENU
     ============================================ */
  function initMobileMenu() {
    var hamburger = document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links');
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', function () {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('open');
      var expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!expanded));
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('active');
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ============================================
     NEWSLETTER
     ============================================ */
  function initNewsletter() {
    var form = document.querySelector('.newsletter__form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('.newsletter__input');
      var success = document.querySelector('.newsletter__success');
      if (input && input.value.trim()) {
        form.style.display = 'none';
        var disclaimer = document.querySelector('.newsletter__disclaimer');
        if (disclaimer) disclaimer.style.display = 'none';
        if (success) {
          success.classList.add('show');
          success.textContent = 'Welcome to the cult. We mean club.';
        }
      }
    });
  }

  /* ============================================
     SMOOTH SCROLL
     ============================================ */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (href === '#') return;
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ============================================
     BACK TO TOP
     ============================================ */
  function initBackToTop() {
    var btn = document.querySelector('.back-to-top');
    if (!btn) return;

    function toggleVisibility() {
      btn.classList.toggle('visible', window.scrollY > 500);
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ============================================
     DATE DISPLAY
     ============================================ */
  function initDateDisplay() {
    var dateline = document.querySelector('.masthead__dateline');
    if (!dateline) return;

    var now = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var dateStr = now.toLocaleDateString('en-US', options);
    dateline.innerHTML = 'Vol. I, No. 1 &ensp;|&ensp; ' + dateStr + ' &ensp;|&ensp; Final Edition &ensp;|&ensp; Price: Free (Your Sanity May Vary)';
  }

  /* ============================================
     LAZY LOAD
     ============================================ */
  function initLazyLoad() {
    var lazyImages = document.querySelectorAll('[data-lazy]');
    if (!lazyImages.length) return;

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-lazy');
            }
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '100px' });

      lazyImages.forEach(function (img) { observer.observe(img); });
    }
  }

  /* ============================================
     SHARE BUTTONS
     ============================================ */
  function initShareButtons() {
    document.querySelectorAll('.share-btn[data-platform]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var platform = btn.getAttribute('data-platform');
        var title = document.querySelector('h1') ? document.querySelector('h1').textContent : document.title;
        var url = window.location.href;

        switch (platform) {
          case 'twitter':
            window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url), '_blank', 'width=550,height=420');
            break;
          case 'facebook':
            window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'width=550,height=420');
            break;
          case 'reddit':
            window.open('https://www.reddit.com/submit?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title), '_blank', 'width=550,height=420');
            break;
          case 'copy':
            if (navigator.clipboard) {
              navigator.clipboard.writeText(url).then(function () {
                var original = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(function () { btn.textContent = original; }, 2000);
              });
            }
            break;
        }
      });
    });
  }

  /* ============================================
     CONTACT FORM
     ============================================ */
  function initContactForm() {
    var form = document.querySelector('.contact-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = form.querySelector('.form-submit');
      if (submitBtn) {
        submitBtn.textContent = 'Message Received!';
        submitBtn.style.background = '#2D5C3F';
        setTimeout(function () {
          form.reset();
          submitBtn.textContent = 'Send Message';
          submitBtn.style.background = '';
        }, 3000);
      }
    });
  }

  /* ============================================
     CLICK-TO-NAVIGATE ANIMATION
     ============================================ */
  function initClickAnimation() {
    if (prefersReducedMotion()) return;

    document.querySelectorAll('.clipping-wrapper a, a.clipping-wrapper--related').forEach(function (link) {
      if (!link.href || link.href === '#' || link.href.startsWith('javascript')) return;

      link.addEventListener('click', function (e) {
        var wrapper = this.closest('.clipping-wrapper') || this;
        e.preventDefault();
        var href = this.href;
        wrapper.style.transition = 'transform 0.3s ease, filter 0.3s ease';
        wrapper.style.transform = 'scale(1.06) rotate(0deg)';
        wrapper.style.filter = 'drop-shadow(10px 16px 30px rgba(0,0,0,0.6))';
        wrapper.style.zIndex = '100';
        setTimeout(function () { window.location.href = href; }, 280);
      });
    });
  }

  /* ============================================
     PARALLAX BACKGROUND
     ============================================ */
  function initParallax() {
    if (prefersReducedMotion() || 'ontouchstart' in window) return;

    document.addEventListener('mousemove', function (e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 8;
      var y = (e.clientY / window.innerHeight - 0.5) * 8;
      document.body.style.backgroundPosition = x + 'px ' + y + 'px';
    });
  }

  /* ============================================
     BREAKING NEWS TYPEWRITER
     ============================================ */
  function initTypewriter() {
    if (prefersReducedMotion()) return;

    var breakingItems = document.querySelectorAll('.breaking-box__items li');
    if (!breakingItems.length) return;

    breakingItems.forEach(function (li, i) {
      var text = li.textContent;
      li.textContent = '';
      var span = document.createElement('span');
      span.className = 'typewriter-text';
      span.textContent = text;
      span.style.animationDelay = (i * 1.8 + 0.5) + 's';
      li.appendChild(span);
    });
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    randomizeClippings();
    initScrollAnimations();
    initMobileMenu();
    initNewsletter();
    initSmoothScroll();
    initBackToTop();
    initDateDisplay();
    initLazyLoad();
    initShareButtons();
    initContactForm();
    initClickAnimation();
    initParallax();
    initTypewriter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
