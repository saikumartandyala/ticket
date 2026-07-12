# LastMinutePass — P2P Ticket Resale Marketplace

LastMinutePass is a peer-to-peer (P2P) ticket transfer marketplace that connects people who want to resell tickets (recovering partial value) with urgent seekers looking for last-minute availability on the same day.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11 + FastAPI + SQLAlchemy Async + SQLite/PostgreSQL
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + Zustand
- **Messaging**: Native WebSockets for real-time chat & status updates
- **Orchestration**: Docker Compose + Nginx Reverse Proxy

---

## 🚀 Getting Started

You can run the application in two ways: **via Docker Compose** (highly recommended) or **locally on your machine**.

### Option 1: Running with Docker Compose

Ensure Docker is running on your machine, then run:

```bash
docker-compose up --build
```

- **Frontend website**: [http://localhost](http://localhost)
- **API backend docs**: [http://localhost/api/docs](http://localhost/api/docs)
- **MeiliSearch dashboard**: [http://localhost:7700](http://localhost:7700)

---

### Option 2: Running Locally (Development Mode)

If you prefer to run services without launching Docker containers, you can execute them directly on your machine. The backend is configured to automatically fall back to a local SQLite database file (`lastminutepass.db`) if Postgres is offline, enabling zero-config run.

#### 1. Running the FastAPI Backend

1. Navigate to the `backend` directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will run on [http://localhost:8000](http://localhost:8000).

#### 2. Running the Next.js Frontend

1. Navigate to the `frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The Next.js website will run on [http://localhost:3000](http://localhost:3000).

---

## 🔑 Developer Bypass Credentials

For ease of testing local workflows (interest matching, chat, contact reveal), we have configured a default testing bypass:

- **Phone input**: Any valid Indian phone format (e.g. `+919988776655` or `+910000000000`)
- **Verification OTP Code**: Enter **`123456`** to bypass the OTP delivery and log in instantly as a verified user.
