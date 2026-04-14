/* ============================================
   NEWS TABLOID NOW - Main JavaScript
   Old-School Newspaper Edition
   ============================================ */

(function () {
  'use strict';

  // --- Theme Toggle ---
  var THEME_KEY = 'ntn-theme';

  function getStoredTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateToggleLabel(theme);
  }

  function updateToggleLabel(theme) {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    var icon = btn.querySelector('.theme-toggle__icon');
    var label = btn.querySelector('.theme-toggle__label');
    if (theme === 'dark') {
      if (icon) icon.textContent = '\u2600';
      if (label) label.textContent = 'Day Edition';
    } else {
      if (icon) icon.textContent = '\u263E';
      if (label) label.textContent = 'Night Edition';
    }
  }

  function initTheme() {
    var stored = getStoredTheme();
    // Light mode is now the default
    var theme = stored || 'light';
    setTheme(theme);

    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
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
          success.textContent = 'Welcome aboard. Extra! Extra! Check your inbox.';
        }
      }
    });
  }

  // --- Smooth Scroll ---
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var target = document.querySelector(this.getAttribute('href'));
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

  // --- Current Date Display ---
  function initDateDisplay() {
    var el = document.querySelector('.top-bar__date');
    if (!el) return;

    var now = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    el.textContent = now.toLocaleDateString('en-US', options);
  }

  // --- Lazy Load Images (IntersectionObserver) ---
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

  // --- Share Buttons ---
  function initShareButtons() {
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

  // --- Initialize Everything ---
  function init() {
    initTheme();
    initMobileMenu();
    initNewsletter();
    initSmoothScroll();
    initBackToTop();
    initDateDisplay();
    initLazyLoad();
    initShareButtons();
    initContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
