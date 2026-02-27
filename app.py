from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import joblib
import numpy as np
import datetime

app = Flask(__name__)
CORS(app)

# Load model safely
try:
    model = joblib.load("final_agent_model.pkl")
    vectorizer = joblib.load("final_agent_vectorizer.pkl")
except Exception as e:
    print(f"Warning: Model files not found or incompatible. Error: {e}")
    model, vectorizer = None, None

# 9 Products with a new 'reviews' list to store the text
products = {
    1: {
        "name": "Aurora ANC Studio Headphones",
        "description": "Flagship-grade wireless headphones tuned for rich detail and deep, controlled bass, with adaptive ANC that fades the world out without flattening your music. A precision metal yoke, memory-foam seals, and multi-device pairing make them a daily-driver that feels genuinely premium.",
        "image_suggestion": "minimalist matte black over-ear headphones on a walnut desk soft daylight",
        "ratings": [],
        "reviews": []
    },
    2: {
        "name": "Nimbus Mesh Wi‑Fi 7 Router",
        "description": "A high-performance Wi‑Fi 7 mesh router built for dense apartments, gaming nights, and multi-device households. Expect steadier speeds, cleaner coverage room-to-room, and a sleek vertical design that doesn’t scream “network gear.”",
        "image_suggestion": "modern white wifi router vertical minimalist living room shelf",
        "ratings": [],
        "reviews": []
    },
    3: {
        "name": "LumenBar Adaptive Monitor Light",
        "description": "An eye-comforting monitor light bar with auto-dimming and a glare-free beam that keeps your workspace crisp without washing out your screen. Touch controls, a premium aluminum body, and a soft backlight glow turn any desk into a focused setup.",
        "image_suggestion": "monitor light bar on ultrawide monitor cozy desk setup dark room",
        "ratings": [],
        "reviews": []
    },
    4: {
        "name": "ArcDock 12‑in‑1 Thunderbolt Hub",
        "description": "A single-cable upgrade that turns your laptop into a full workstation with fast data, clean 4K display output, and stable wired networking. Built with a heat-managed aluminum shell and thoughtfully spaced ports to keep your setup tidy and dependable.",
        "image_suggestion": "aluminum usb c hub thunderbolt dock connected to laptop on minimal desk",
        "ratings": [],
        "reviews": []
    },
    5: {
        "name": "EchoFrame Spatial Soundbar",
        "description": "A premium compact soundbar engineered for wide, room-filling sound with clear dialogue and cinematic impact at low to medium volumes. With seamless wireless streaming and an understated design, it elevates your TV without turning your room into a speaker showroom.",
        "image_suggestion": "sleek black soundbar under wall mounted tv modern living room",
        "ratings": [],
        "reviews": []
    },
    6: {
        "name": "PulseRing Smart Health Tracker",
        "description": "A minimalist smart ring that tracks key health signals with a comfortable, lightweight fit you’ll forget you’re wearing. Water resistance, long battery life, and a clean companion app make it perfect for consistent, no-fuss insights.",
        "image_suggestion": "titanium smart ring on stone surface minimalist product photo",
        "ratings": [],
        "reviews": []
    },
    7: {
        "name": "BreezeSense Air Quality Monitor",
        "description": "A premium indoor air monitor that keeps an eye on the things you can’t see, then makes the data instantly understandable at a glance. Set smart alerts, spot patterns over time, and take action confidently—especially in bedrooms and workspaces.",
        "image_suggestion": "modern indoor air quality monitor on bedside table minimal aesthetic",
        "ratings": [],
        "reviews": []
    },
    8: {
        "name": "GlidePro Ergonomic Mechanical Keyboard",
        "description": "A refined mechanical keyboard with a cushioned typing feel, satisfying acoustics, and a layout designed for long sessions. Hot-swappable switches, per-key lighting, and a solid chassis deliver customization without compromising the premium build.",
        "image_suggestion": "premium mechanical keyboard on clean desk setup top down soft lighting",
        "ratings": [],
        "reviews": []
    },
    9: {
        "name": "ForgeCharge 3‑Device Magnetic Stand",
        "description": "A streamlined magnetic charging stand that powers your phone, earbuds, and smartwatch in one clean footprint. Weighted stability, smart cable routing, and a soft-touch finish make it feel like it belongs on a modern nightstand or executive desk.",
        "image_suggestion": "3 in 1 magnetic charging stand on nightstand with smartphone smartwatch earbuds",
        "ratings": [],
        "reviews": []
    }
}


@app.route("/")
def home():
    return render_template("index.html", products=products)

@app.route("/product/<int:product_id>")
def product_page(product_id):
    ratings = products[product_id]["ratings"]
    avg_rating = np.mean(ratings) if ratings else 0
    breakdown = {i: ratings.count(i) for i in range(1,6)}
    
    return render_template(
        "product.html", 
        product=products[product_id], 
        product_id=product_id,
        avg_rating=round(avg_rating, 2),
        total_reviews=len(ratings),
        breakdown=breakdown
    )

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        review = data.get("review", "")
        product_id = data.get("product_id")

        if not review.strip():
            return jsonify({"error": "Review cannot be empty"}), 400

        # Try to predict, fallback to a default if the model fails
        if model and vectorizer:
            review_vector = vectorizer.transform([review])
            prediction = model.predict(review_vector)[0]
            rating = int(prediction)
        else:
            rating = 5 # Fallback rating if ML fails

        # Save the rating
        products[product_id]["ratings"].append(rating)

        # Save the text and date for the UI
        new_review = {
            "text": review,
            "rating": rating,
            "date": datetime.datetime.now().strftime("%B %d, %Y")
        }
        # Insert at the beginning so newest is first
        products[product_id]["reviews"].insert(0, new_review)

        avg_rating = np.mean(products[product_id]["ratings"])
        breakdown = {i: products[product_id]["ratings"].count(i) for i in range(1,6)}

        return jsonify({
            "predicted_rating": rating,
            "average_rating": round(avg_rating, 2),
            "total_reviews": len(products[product_id]["ratings"]),
            "breakdown": breakdown,
            "new_review": new_review # Send back to frontend to display immediately
        })
        
    except Exception as e:
        print(f"Server Error during prediction: {e}")
        return jsonify({"error": "Server failed to process the review. Check console."}), 500

if __name__ == "__main__":
    app.run(debug=True)