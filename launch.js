document.addEventListener("DOMContentLoaded", () => {

  const startButtons = document.querySelectorAll(".start-learning-btn, #topStartBtn");
  const teacherButtons = document.querySelectorAll(".teacher-access-btn");

  startButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = "app.html";
    });
  });

  teacherButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = "app.html?role=teacher";
    });
  });

  const revealItems = document.querySelectorAll(
    ".section-heading, .info-card, .step-card, .level-card, .activity-grid div, .student-card, .testimonial-card, .teacher-panel-card, .hero-card"
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

  const navbar = document.querySelector(".navbar");

  if (navbar) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 30) {
        navbar.style.background = "rgba(3, 17, 28, 0.82)";
        navbar.style.backdropFilter = "blur(14px)";
        navbar.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
        navbar.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      } else {
        navbar.style.background = "transparent";
        navbar.style.backdropFilter = "none";
        navbar.style.boxShadow = "none";
        navbar.style.borderBottom = "none";
      }
    });
  }

});
