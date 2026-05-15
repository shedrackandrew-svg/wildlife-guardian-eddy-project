// Professional Navigation JavaScript

document.addEventListener('DOMContentLoaded', function() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navMenu');
  const navDropdowns = document.querySelectorAll('.nav-dropdown');

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
