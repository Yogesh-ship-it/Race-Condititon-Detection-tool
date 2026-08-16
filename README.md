
# RaceGuard: Race Condition Detection & Visualization Dashboard

![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)
![Framework](https://img.shields.io/badge/framework-Flask-green.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)
![Domain](https://img.shields.io/badge/domain-Concurrency%20%26%20Operating%20Systems-orange.svg)

**RaceGuard** is an interactive educational and analytical tool designed to simulate multi-threaded operations, detect data races using formal computer science models, and visualize memory access conflicts in real-time.

---

## 🌟 Key Features

- **Formal Race Detection Engine**:
  - **Bernstein’s Conditions**: Evaluates Read-Set ($R$) and Write-Set ($W$) intersections across concurrent threads ($R_i \cap W_j \neq \emptyset$, $W_i \cap R_j \neq \emptyset$, $W_i \cap W_j \neq \emptyset$).
  - **Lockset (Eraser) Algorithm**: Tracks candidate locksets $C(v)$ for shared memory variables to detect unsynchronized accesses.
- **Native OS Code Exporter**:
  - Automatically compiles simulation traces into native, runnable source code:
    - **POSIX Threads (C)** using `pthread_mutex_t`
    - **Python Threading** using `threading.Lock`
- **Interactive Visualization Dashboard**:
  - **Memory Access Heatmap**: Highlights hot memory locations subject to frequent write contention.
  - **Dynamic Timeline & Event Log Editor**: Add, remove, or modify thread events dynamically.
- **Pre-loaded Concurrency Scenarios**:
  - Counter++ Increment Race
  - Double-Bank Account Transfer
  - Producer-Consumer Queue Buffer
  - Reader-Writer Lock Synchronization
- **Customizable UI Themes**:
  - Toggle between **Slate**, **Obsidian**, and **Warm Charcoal** color palettes for optimal visual clarity.

---

## 📁 Repository Structure

```
Race-Condititon-Detection-tool/
├── backend/
│   ├── app.py              # Flask server REST API & routes
│   ├── detector.py         # Bernstein's & Eraser Lockset Detection Engine
│   ├── code_generator.py   # Native C (pthreads) & Python code generator
│   ├── scenarios.py        # Pre-configured concurrency test scenarios
│   ├── test_detector.py    # Unit testing suite for detection logic
│   ├── run.py              # Launch script with automatic dependency setup
│   ├── run.bat             # Windows executable launcher
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── templates/
│   │   └── index.html      # Main dashboard HTML template
│   └── static/
│       ├── css/
│       │   └── style.css   # Dynamic styles & theme tokens
│       ├── js/
│       │   └── app.js      # Dashboard controller & interactive renderer
│       ├── images/         # UI theme previews and screenshots
│       └── preview.html    # Standalone design preview page
├── .gitignore              # Files excluded from git tracking
└── README.md               # Project documentation
```

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- **Python 3.8+** installed on your system.
- **Git** for version control.

### 2. Setup & Run Backend

Clone the repository and navigate into the `backend` directory:

```bash
git clone https://github.com/Yogesh-ship-it/Race-Condititon-Detection-tool.git
cd Race-Condititon-Detection-tool/backend
```

Install requirements:
```bash
pip install -r requirements.txt
```

Launch the RaceGuard Web Server:
```bash
python run.py
```
*(On Windows, you can also double-click `run.bat` or execute `python app.py`)*

### 3. Open the Dashboard

Open your web browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🧪 Running Tests

To verify the race condition detection algorithm against built-in test suites:

```bash
cd backend
python test_detector.py
```

Expected Output:
```text
--- Counter++ Buggy ---
Total races: 3 | Critical count: 1
PASSED Counter Buggy Test!
--- Counter++ Fixed ---
Total races: 0
PASSED Counter Fixed Test!
...
ALL DETECTOR UNIT TESTS PASSED SUCCESSFULLY!
```

---

## 🔬 Detection Algorithms Overview

### 1. Bernstein's Conditions
For two concurrently executing tasks $T_1$ and $T_2$ with read sets $R_1, R_2$ and write sets $W_1, W_2$:
$$\text{Race Exists} \iff (R_1 \cap W_2 \neq \emptyset) \lor (W_1 \cap R_2 \neq \emptyset) \lor (W_1 \cap W_2 \neq \emptyset)$$

### 2. Lockset (Eraser) Algorithm
For each shared variable $v$:
1. Initialize candidate lockset $C(v)$ with all held locks.
2. For each memory access to $v$ by thread $t$ holding locks $L(t)$:
   $$C(v) \leftarrow C(v) \cap L(t)$$
3. If $C(v) = \emptyset$ during a write operation, a data race is reported.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
# Race-Condititon-Detection-tool

