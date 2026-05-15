// ============ WILDGUARD ANIMATION ENGINE ============

class AnimationEngine {
  constructor() {
    this.initIntersectionObserver();
    this.initScrollAnimations();
    this.initCounterAnimation();
    this.initCarouselAnimation();
    this.initButtonAnimations();
  }

  // Intersection Observer for scroll-triggered animations
  initIntersectionObserver() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Add animation class
          entry.target.classList.add('in-view');

          // Unobserve after animation triggers
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe all elements with animation classes
    document.querySelectorAll('[class*="fade-in"], [class*="slide-in"], [class*="scale-in"], .feature-card, .highlight-card, .stat-item, .about-text, .about-stats').forEach(el => {
      observer.observe(el);
    });
  }

  // Scroll animations for sections
  initScrollAnimations() {
    // Observe feature cards
    const cards = document.querySelectorAll('.feature-card');
    cards.forEach((card, index) => {
      card.classList.add('fade-in');
      card.style.animationDelay = `${index * 0.1}s`;
    });

    // Observe highlight cards
    const highlights = document.querySelectorAll('.highlight-card');
    highlights.forEach((card, index) => {
      card.classList.add('scale-in');
      card.style.animationDelay = `${index * 0.1}s`;
    });

    // Observe about section
    const aboutText = document.querySelector('.about-text');
    const aboutStats = document.querySelector('.about-stats');
    if (aboutText) aboutText.classList.add('slide-in-left');
    if (aboutStats) aboutStats.classList.add('slide-in-right');
  }

  // Animated counter for stats
  initCounterAnimation() {
    const counters = document.querySelectorAll('.counter');
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
          entry.target.classList.add('counted');
          this.animateCounter(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(counter => counterObserver.observe(counter));
  }

  animateCounter(element) {
    const target = parseInt(element.textContent) || 0;
    const duration = 2000; // 2 seconds
    const increment = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        element.textContent = target;
        clearInterval(timer);
      } else {
        element.textContent = Math.floor(current);
      }
    }, 16);
  }

  // Bootstrap carousel-style animation
  initCarouselAnimation() {
    const carousel = document.querySelector('.cinema-stage');
    if (!carousel) return;

    // Add carousel class for styling
    carousel.classList.add('carousel-animated');

    // Fade effects on slides
    const slides = carousel.querySelectorAll('.cinema-slide');
    slides.forEach((slide, index) => {
      slide.style.animationDelay = `${index * 0.2}s`;
    });
  }

  // Button ripple and glow animations
  initButtonAnimations() {
    const buttons = document.querySelectorAll('.btn, .feature-link, .nav-menu a');

    buttons.forEach(button => {
      // Add hover animation
      button.addEventListener('mouseenter', () => {
        button.style.animation = 'none';
        setTimeout(() => {
          button.style.animation = '';
        }, 10);
      });

      // Add click ripple effect
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.classList.add('ripple');

        // Clean up previous ripples
        const oldRipples = this.querySelectorAll('.ripple');
        oldRipples.forEach(r => r.remove());

        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
      });
    });
  }

  // Smooth page scroll animations
  initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // Animated text effects
  animateText(element, duration = 1000) {
    const text = element.textContent;
    element.textContent = '';
    let index = 0;

    const interval = duration / text.length;
    const timer = setInterval(() => {
      element.textContent += text[index];
      index++;
      if (index >= text.length) clearInterval(timer);
    }, interval);
  }

  // Parallax scroll effect
  initParallax() {
    const parallaxElements = document.querySelectorAll('.parallax-bg');
    
    if (parallaxElements.length > 0) {
      window.addEventListener('scroll', () => {
        parallaxElements.forEach(el => {
          const scrollPosition = window.pageYOffset;
          el.style.backgroundPosition = `center ${scrollPosition * 0.5}px`;
        });
      });
    }
  }

  // Staggered animations for lists
  animateList(selector) {
    const items = document.querySelectorAll(selector);
    items.forEach((item, index) => {
      item.style.animationDelay = `${index * 0.1}s`;
      item.classList.add('animate', 'fadeInUp');
    });
  }
}

// Initialize animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const engine = new AnimationEngine();

  // Add additional animations
  engine.initSmoothScroll();
  engine.initParallax();

  // Animate hero text
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    heroTitle.classList.add('animated-text');
  }

  // Add glow animation to buttons
  document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.style.animation = 'glow 2s ease-in-out infinite';
  });

  // Add staggered animation to feature cards
  engine.animateList('.feature-card');
  engine.animateList('.highlight-card');
  engine.animateList('.footer-column');

  // Page visibility animation
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Re-trigger animations when page becomes visible
      document.querySelectorAll('[class*="in-view"]').forEach(el => {
        el.classList.remove('in-view');
        setTimeout(() => el.classList.add('in-view'), 100);
      });
    }
  });

  console.log('🐾 WildGuard Animation Engine initialized');
});

// Add ripple style dynamically
const style = document.createElement('style');
style.textContent = `
  .btn, .feature-link, .nav-menu a {
    position: relative;
    overflow: hidden;
  }

  .ripple {
    position: absolute;
    background: radial-gradient(circle, rgba(255,255,255,0.6), transparent 70%);
    border-radius: 50%;
    transform: scale(0);
    animation: ripple-animation 0.6s ease-out;
    pointer-events: none;
  }

  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ============ ANIMATION ENGINE END ============
