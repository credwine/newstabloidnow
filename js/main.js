/* ============================================
   NEWS TABLOID NOW - Main JavaScript
   Torn Newspaper Clippings - CHAOS EDITION
   ============================================ */

(function () {
  'use strict';

  // Animation classes for varied entrance effects
  var ANIM_CLASSES = ['anim-slam', 'anim-fly-left', 'anim-fly-right', 'anim-fly-bottom', 'anim-pop'];

  // Check if user prefers reduced motion
  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // --- Scroll Animation (IntersectionObserver) with VARIED animations ---
  function initScrollAnimations() {
    var targets = document.querySelectorAll(
      '.clipping-wrapper, .clipping-wrapper--related, .breaking-wrapper, .newsletter-wrapper, ' +
      '.about-intro-wrapper, .team-clipping-wrapper, .contact-wrapper, ' +
      '.disclaimer-wrapper'
    );

    if (!targets.length) return;

    // Pre-assign random animation classes to each clipping wrapper
    if (!prefersReducedMotion()) {
      targets.forEach(function (el, i) {
        if (el.classList.contains('clipping-wrapper') || el.classList.contains('clipping-wrapper--related')) {
          // Assign a varied animation class based on position + some randomness
          var animIndex = (i * 7 + i * i * 3) % ANIM_CLASSES.length;
          el.classList.add(ANIM_CLASSES[animIndex]);
          // Stagger animation delays based on position
          el.style.animationDelay = (i * 0.12) + 's';
        }
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
      }, {
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px'
      });

      targets.forEach(function (el) {
        observer.observe(el);
      });
    } else {
      // Fallback: show everything immediately
      targets.forEach(function (el) {
        el.classList.add('in-view');
      });
    }
  }

  // --- Mobile Menu ---
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

    // Close on link click
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.classList.remove('active');
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // --- Newsletter Form ---
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

  // --- Smooth Scroll ---
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

  // --- Back to Top Button ---
  function initBackToTop() {
    var btn = document.querySelector('.back-to-top');
    if (!btn) return;

    function toggleVisibility() {
      if (window.scrollY > 500) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }

    window.addEventListener('scroll', toggleVisibility, { passive: true });

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // --- Current Date Display (masthead) ---
  function initDateDisplay() {
    var dateline = document.querySelector('.masthead__dateline');
    if (!dateline) return;

    var now = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var dateStr = now.toLocaleDateString('en-US', options);

    // Update the dateline text while keeping the format
    dateline.innerHTML = 'Vol. I, No. 1 &ensp;|&ensp; ' + dateStr + ' &ensp;|&ensp; Final Edition &ensp;|&ensp; Price: Free (Your Sanity May Vary)';
  }

  // --- Lazy Load Images (native + fallback) ---
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

      lazyImages.forEach(function (img) {
        observer.observe(img);
      });
    }
  }

  // --- Share Buttons (both old .share-btn--X and new data-platform) ---
  function initShareButtons() {
    // New data-platform share buttons (article pages)
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

    // Legacy class-based share buttons (index page)
    document.querySelectorAll('.share-btn--copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = window.location.href;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            btn.textContent = 'Copied!';
            setTimeout(function () {
              btn.textContent = 'Copy Link';
            }, 2000);
          });
        }
      });
    });

    document.querySelectorAll('.share-btn--twitter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var title = document.querySelector('h1') ? document.querySelector('h1').textContent : document.title;
        var url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(window.location.href);
        window.open(url, '_blank', 'width=550,height=420');
      });
    });

    document.querySelectorAll('.share-btn--facebook').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(window.location.href);
        window.open(url, '_blank', 'width=550,height=420');
      });
    });

    document.querySelectorAll('.share-btn--reddit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var title = document.querySelector('h1') ? document.querySelector('h1').textContent : document.title;
        var url = 'https://www.reddit.com/submit?url=' + encodeURIComponent(window.location.href) + '&title=' + encodeURIComponent(title);
        window.open(url, '_blank', 'width=550,height=420');
      });
    });
  }

  // --- Contact Form ---
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

  // --- Click-to-Navigate Animation ---
  // Briefly scales up clipping before navigating to article
  function initClickAnimation() {
    if (prefersReducedMotion()) return;

    document.querySelectorAll('.clipping-wrapper a, .clipping a.clipping__headline a').forEach(function (link) {
      // Only intercept links that navigate to another page
      if (!link.href || link.href === '#' || link.href.startsWith('javascript')) return;

      link.addEventListener('click', function (e) {
        var wrapper = this.closest('.clipping-wrapper') || this.closest('.clipping-wrapper--related');
        if (wrapper) {
          e.preventDefault();
          var href = this.href;
          wrapper.style.transition = 'transform 0.3s ease, filter 0.3s ease';
          wrapper.style.transform = 'scale(1.05)';
          wrapper.style.filter = 'drop-shadow(10px 16px 30px rgba(0,0,0,0.6))';
          wrapper.style.zIndex = '100';
          setTimeout(function () { window.location.href = href; }, 300);
        }
      });
    });

    // Also handle the wrapper-level links (related articles use <a class="clipping-wrapper--related">)
    document.querySelectorAll('a.clipping-wrapper--related').forEach(function (link) {
      if (!link.href) return;

      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = this.href;
        this.style.transition = 'transform 0.3s ease, filter 0.3s ease';
        this.style.transform = 'scale(1.05)';
        this.style.filter = 'drop-shadow(10px 16px 30px rgba(0,0,0,0.6))';
        this.style.zIndex = '100';
        setTimeout(function () { window.location.href = href; }, 300);
      });
    });
  }

  // --- Parallax Background ---
  // Subtle mouse-move parallax on the dark surface background
  function initParallax() {
    if (prefersReducedMotion()) return;

    // Only on desktop (no touch)
    if ('ontouchstart' in window) return;

    document.addEventListener('mousemove', function (e) {
      var x = (e.clientX / window.innerWidth - 0.5) * 8;
      var y = (e.clientY / window.innerHeight - 0.5) * 8;
      document.body.style.backgroundPosition = x + 'px ' + y + 'px';
    });
  }

  // --- Breaking News Typewriter Effect ---
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

  // --- Cursor Enhancement ---
  // Add cursor: grab on clipping hover for the scrapbook feel
  function initCursorEffects() {
    var style = document.createElement('style');
    style.textContent =
      '.clipping-wrapper { cursor: grab; }' +
      '.clipping-wrapper:active { cursor: grabbing; }' +
      '.clipping-wrapper a, .clipping a[href], a.clipping-wrapper--related { cursor: pointer; }';
    document.head.appendChild(style);
  }

  // --- Initialize Everything ---
  function init() {
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
    initCursorEffects();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
