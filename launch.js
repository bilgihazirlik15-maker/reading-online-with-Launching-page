document.addEventListener("DOMContentLoaded", () => {
  const startButtons = document.querySelectorAll(".start-learning-btn, #topStartBtn");
  const teacherButtons = document.querySelectorAll(".teacher-access-btn");

  startButtons.forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  teacherButtons.forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = "index.html?role=teacher";
  });
});

  const revealItems = document.querySelectorAll(
    ".section-heading, .info-card, .step-card, .level-card, .activity-grid div, .student-card, .testimonial-card, .teacher-panel-card"
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
});
