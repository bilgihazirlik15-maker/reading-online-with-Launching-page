document.addEventListener("DOMContentLoaded", () => {

  // =========================
  // BUTTON REDIRECTS
  // =========================

  const startButtons = document.querySelectorAll(
    ".start-learning-btn, #topStartBtn"
  );

  const teacherButtons = document.querySelectorAll(
    ".teacher-access-btn"
  );

  startButtons.forEach((button) => {
    button.addEventListener("click", () => {

      // MAIN PLATFORM
      window.location.href = "app.html";

    });
  });

  teacherButtons.forEach((button) => {
    button.addEventListener("click", () => {

      // TEACHER LOGIN FLOW
      window.location.href = "app.html?role=teacher";

    });
  });



  // =========================
  // SCROLL REVEAL ANIMATIONS
  // =========================

  const revealItems = document.querySelectorAll(
    `
    .section-heading,
    .info-card,
    .step-card,
    .level-card,
    .activity-grid div,
    .student-card,
    .testimonial-card,
    .teacher-panel-card,
    .hero-card
    `
  );

  revealItems.forEach((item) => {
    item.classList.add("reveal");
  });

  const observer = new IntersectionObserver(
    (entries) => {

      entries.forEach((entry) => {

        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }

      });

    },
    {
      threshold: 0.15
    }
  );

  revealItems.forEach((item) => {
    observer.observe(item);
  });



  // =========================
  // NAVBAR SHADOW ON SCROLL
  // =========================

  const navbar = document.querySelector(".navbar");

  window.addEventListener("scroll", () => {

    if (window.scrollY > 30) {

      navbar.style.background =
        "rgba(3, 17, 28, 0.82)";

      navbar.style.backdropFilter =
        "blur(14px)";

      navbar.style.boxShadow =
        "0 10px 30px rgba(0,0,0,0.25)";

      navbar.style.borderBottom =
        "1px solid rgba(255,255,255,0.08)";

    } else {

      navbar.style.background = "transparent";
      navbar.style.backdropFilter = "none";
      navbar.style.boxShadow = "none";
      navbar.style.borderBottom = "none";

    }

  });



  // =========================
  // SMOOTH BUTTON HOVER EFFECT
  // =========================

  const buttons = document.querySelectorAll(
    ".primary-btn, .secondary-btn, .nav-login-btn"
  );

  buttons.forEach((button) => {

    button.addEventListener("mouseenter", () => {

      button.style.transform = "translateY(-2px) scale(1.02)";

    });

    button.addEventListener("mouseleave", () => {

      button.style.transform = "translateY(0px) scale(1)";

    });

  });

});
