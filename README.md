# CNC Tool Usage Dashboard

A professional web dashboard for monitoring tool life and usage statistics across different machines and lines.

## Features
- Dynamic Tool Usage Visualization (30-day view)
- Filterable by Year, Month, Line, Machine, and Tool Type
- Real-time calculations of usage percentages and life thresholds
- Responsive sidebar navigation

## Prerequisites
- [Node.js](https://nodejs.org/) (v14 or later)
- [PostgreSQL](https://www.postgresql.org/) Database

## Getting Started

### 1. Clone or Download the repository
```bash
git clone https://github.com/Suthananun/Project_4thyear.git
cd Project_4thyear
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a file named `.env` in the root directory and add your database credentials:
```env
DB_USER=your_username
DB_HOST=your_host
DB_DATABASE=your_database
DB_PASSWORD=your_password
DB_PORT=5432
PORT=3001
```

### 4. Run the Server
```bash
npm start
```
The dashboard will be available at `http://localhost:3001`.

---
*Created for Final Project - 4th Year*

## A