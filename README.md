# SePRINT — Student Express Web-Printing Service

SePRINT is a responsive, account-free web application designed for on-campus student printing services[cite: 1, 3]. It eliminates manual text-message communication loops by centralizing document uploads, calculating prices programmatically, and supplying a real-time tracking interface for students alongside an administrative dashboard for print operators[cite: 1, 3, 10].

---

## 🏗️ Project Architecture & Tech Stack

SePRINT leverages a modern, decoupled serverless architecture:
*   **Frontend Layer:** Native HTML5, CSS3, and modern Vanilla JavaScript (ES6+ Modules) styled with atomic utility design tokens using **Tailwind CSS**[cite: 3, 4, 6].
*   **Database & Auth Layer:** **Google Firebase Firestore** handles real-time data synchronization for customer transactions and operator availability, while **Firebase Auth** secures the operator board.
*   **Object Storage Layer:** **Supabase Storage Buckets** securely stream, isolate, and host user document uploads and payment receipts[cite: 1, 4, 10].
*   **Core Libraries:** `pdf-lib.js` for client-side binary page counting and `feather-icons` for scalable vector UI components[cite: 3, 7].

---

## 📂 File Directory Structure

```text
├── .gitignore              # Excludes local configuration and node modules
├── README.md               # Project documentation and setup guide
├── index.html              # Core application single-page view wrapper[cite: 3, 4]
├── styles.css              # Custom layout properties and mobile adjustments[cite: 4, 5]
├── tailwind.config.js      # Tailwind CDN configuration rules[cite: 3, 4, 6]
├── ui.js                   # Client view control and instant pricing logic[cite: 4, 7]
├── app.js                  # Main data integration core (Firebase + Supabase logic)[cite: 3, 4, 10]
├── config.example.js       # Safe configuration template to push to Git repository
└── config.js               # Deployed API keys (GIT-IGNORED — Local / Server ONLY)[cite: 2, 4, 9]