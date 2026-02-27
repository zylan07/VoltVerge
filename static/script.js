// --- Global Variables ---
let chart;

// --- Initialize Everything on Page Load ---
document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Theme Management
    const themeToggle = document.getElementById("themeToggle");
    const body = document.body;

    function applyTheme(theme) {
        if (theme === "dark") {
            body.classList.add("dark");
            if (themeToggle) themeToggle.innerText = "☀️";
        } else {
            body.classList.remove("dark");
            if (themeToggle) themeToggle.innerText = "🌙";
        }
        // Update chart colors if the chart is currently on the screen
        if (typeof updateChartStyleForTheme === "function") {
            updateChartStyleForTheme();
        }
    }

    const savedTheme = localStorage.getItem("theme") || "light";
    applyTheme(savedTheme);

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const newTheme = body.classList.contains("dark") ? "light" : "dark";
            localStorage.setItem("theme", newTheme);
            applyTheme(newTheme);
        });
    }

    // 2. Dynamic Search Functionality
    const searchBar = document.getElementById("searchBar");
    const productGrid = document.querySelector(".grid");

    if (searchBar && productGrid) {
        // Create a 'No results' message dynamically
        const noResultsMsg = document.createElement("div");
        noResultsMsg.className = "no-results-msg";
        noResultsMsg.style.display = "none";
        noResultsMsg.style.gridColumn = "1 / -1"; 
        noResultsMsg.style.textAlign = "center";
        noResultsMsg.style.padding = "40px 20px";
        noResultsMsg.style.color = "var(--text-secondary)";
        noResultsMsg.innerHTML = `
            <h3 style="font-size: 1.5rem; margin-bottom: 10px;">No products found</h3>
            <p>Try adjusting your search terms.</p>
        `;
        productGrid.appendChild(noResultsMsg);

        // Listen for typing events
        searchBar.addEventListener("input", function() {
            const value = this.value.toLowerCase().trim();
            const cards = document.querySelectorAll(".card");
            let hasVisibleCards = false;

            cards.forEach(card => {
                const title = card.querySelector("h3")?.innerText.toLowerCase() || "";
                const desc = card.querySelector(".description")?.innerText.toLowerCase() || "";
                
                // Show card if title or description match
                if (title.includes(value) || desc.includes(value)) {
                    card.style.display = "flex"; 
                    hasVisibleCards = true;
                } else {
                    card.style.display = "none"; 
                }
            });

            // Toggle the "No Results" message
            noResultsMsg.style.display = hasVisibleCards ? "none" : "block";
        });
    }
});

// --- Toast Notifications ---
function showToast(message, isError = false) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = message;
    if (isError) toast.style.borderLeftColor = "#ef4444"; 

    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// --- Dynamic Feed Appender ---
function appendReviewToFeed(reviewObj) {
    const list = document.getElementById("reviewsList");
    const emptyMsg = document.getElementById("noReviewsMsg");
    if (emptyMsg) emptyMsg.remove();
    if (!list) return;

    const stars = "⭐".repeat(reviewObj.rating);
    const card = document.createElement("div");
    card.className = "review-card fade-in";
    card.innerHTML = `
        <div class="review-header">
            <span class="review-stars">${stars}</span>
            <span class="review-date">${reviewObj.date}</span>
        </div>
        <p class="review-text">${reviewObj.text}</p>
    `;
    list.prepend(card); 
}

// --- API Submission ---
async function submitReview(productId) {
    const reviewInput = document.getElementById("reviewText");
    const review = reviewInput.value.trim();
    const btn = document.querySelector(".primary-btn");

    if (!review) {
        showToast("Please write a review before submitting!", true);
        return;
    }

    const originalText = btn.innerText;
    btn.innerText = "Analyzing Tone...";
    btn.disabled = true;

    try {
        const response = await fetch("/predict", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ review: review, product_id: productId })
        });

        if (!response.ok) {
            let errorMsg = "Server error occurred.";
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch(e) {}
            throw new Error(errorMsg);
        }

        const data = await response.json();

        const avgEl = document.getElementById("avgRating");
        const totalEl = document.getElementById("totalReviews");
        if(avgEl) avgEl.innerText = data.average_rating;
        if(totalEl) totalEl.innerText = data.total_reviews;
        
        reviewInput.value = "";
        appendReviewToFeed(data.new_review);
        updateChart(data.breakdown);
        showToast(`AI successfully rated your review ${data.predicted_rating}⭐`);

    } catch (error) {
        console.error("Submission error:", error);
        showToast(error.message || "Failed to connect to the server.", true);
    } finally {
        if(btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// --- Chart Rendering ---
function getChartColors() {
    const isDark = document.body.classList.contains("dark");
    return {
        text: isDark ? '#9ca3af' : '#64748b',
        grid: isDark ? '#1f2937' : '#e2e8f0',
        bar: '#6366f1',
        barHover: '#4f46e5'
    };
}

function updateChartStyleForTheme() {
    if(!chart) return;
    const colors = getChartColors();
    chart.options.scales.x.ticks.color = colors.text;
    chart.options.scales.y.ticks.color = colors.text;
    chart.options.scales.y.grid.color = colors.grid;
    chart.update();
}

function updateChart(breakdown) {
    const ctx = document.getElementById("ratingChart");
    if(!ctx) return; 
    
    if (typeof Chart === 'undefined') {
        console.error("Chart.js library is missing!");
        return;
    }

    // Safely parse integers from the Python backend
    const d1 = breakdown["1"] || breakdown[1] || 0;
    const d2 = breakdown["2"] || breakdown[2] || 0;
    const d3 = breakdown["3"] || breakdown[3] || 0;
    const d4 = breakdown["4"] || breakdown[4] || 0;
    const d5 = breakdown["5"] || breakdown[5] || 0;

    const colors = getChartColors();
    if(chart) chart.destroy();
    
    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["1⭐", "2⭐", "3⭐", "4⭐", "5⭐"],
            datasets: [{
                label: "Ratings",
                backgroundColor: colors.bar,
                hoverBackgroundColor: colors.barHover,
                borderRadius: 8,
                data: [d1, d2, d3, d4, d5]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: colors.text }, grid: { color: colors.grid, drawBorder: false } },
                x: { grid: { display: false }, ticks: { color: colors.text, font: { weight: '600' } } }
            },
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, cornerRadius: 8 } },
            animation: { duration: 800, easing: 'easeOutQuart' }
        }
    });
}