// Professional Navigation JavaScript

document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  const navDropdowns = document.querySelectorAll('.nav-dropdown');
  const heroSlides = document.querySelectorAll('.hero-slide');
  const heroDots = document.querySelectorAll('.hero-dot');
  let activeHeroSlide = 0;
  let heroTimer = null;

  // Mobile Menu Toggle
  if (mobileMenuBtn && navMenu) {
    mobileMenuBtn.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      navMenu.setAttribute('aria-expanded', !isExpanded);
      
      // Close dropdowns when opening/closing main menu
      navDropdowns.forEach(dropdown => {
        dropdown.removeAttribute('data-expanded');
      });
    });

    // Close menu when clicking links
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        // Allow dropdown parents to work differently
        if (!this.classList.contains('nav-parent')) {
          mobileMenuBtn.setAttribute('aria-expanded', 'false');
          navMenu.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  function showHeroSlide(index) {
    if (!heroSlides.length) {
      return;
    }

    const nextIndex = (index + heroSlides.length) % heroSlides.length;
    activeHeroSlide = nextIndex;

    heroSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle('is-active', slideIndex === nextIndex);
    });

    heroDots.forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === nextIndex);
      dot.setAttribute('aria-pressed', dotIndex === nextIndex ? 'true' : 'false');
    });
  }

  heroDots.forEach((dot, index) => {
    dot.addEventListener('click', function() {
      showHeroSlide(index);
      resetHeroTimer();
    });
  });

  function startHeroTimer() {
    if (heroSlides.length > 1) {
      heroTimer = window.setInterval(() => {
        showHeroSlide(activeHeroSlide + 1);
      }, 6200);
    }
  }

  function resetHeroTimer() {
    if (heroTimer) {
      window.clearInterval(heroTimer);
    }
    startHeroTimer();
  }

  showHeroSlide(0);
  startHeroTimer();

  // Desktop Dropdown Menu Parents
  document.querySelectorAll('.nav-parent').forEach(parent => {
    parent.addEventListener('click', function(e) {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        const dropdown = this.closest('.nav-dropdown');
        const isExpanded = dropdown.getAttribute('data-expanded') === 'true';
        
        // Close other dropdowns
        navDropdowns.forEach(d => {
          if (d !== dropdown) {
            d.removeAttribute('data-expanded');
          }
        });
        
        // Toggle current dropdown
        if (isExpanded) {
          dropdown.removeAttribute('data-expanded');
        } else {
          dropdown.setAttribute('data-expanded', 'true');
        }
      }
    });
  });

  // Close menu on scroll
  window.addEventListener('scroll', function() {
    if (mobileMenuBtn && mobileMenuBtn.getAttribute('aria-expanded') === 'true') {
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      navMenu.setAttribute('aria-expanded', 'false');
    }
  });

  // Close menu on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenuBtn && mobileMenuBtn.getAttribute('aria-expanded') === 'true') {
      mobileMenuBtn.setAttribute('aria-expanded', 'false');
      navMenu.setAttribute('aria-expanded', 'false');
    }
  });

  // Add active class to current page link
  const currentPage = window.location.pathname;
  document.querySelectorAll('.nav-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (currentPage.includes(href) || (href === '/' && currentPage === '/'))) {
      link.classList.add('active');
    }
  });

  // Scroll reveal for sections and cards
  const revealTargets = document.querySelectorAll('.content-section, .feature-card, .highlight-card, .footer-column, .about-stats, .about-text');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -80px 0px' });

  revealTargets.forEach(target => {
    target.classList.add('reveal-on-scroll');
    revealObserver.observe(target);
  });

  // Pause carousel when tab is hidden
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (heroTimer) {
        window.clearInterval(heroTimer);
      }
    } else {
      resetHeroTimer();
    }
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
