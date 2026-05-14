# 🖥️ Smart Parking Management Dashboard

A modern, high-performance administrative interface for real-time parking monitoring and facility management. Built with **React 19**, **TypeScript**, and **Tailwind CSS**.

## 🎨 Design Philosophy
- **Premium Aesthetics**: Clean, dark-mode optimized interface with a focus on data visualization.
- **Real-time Responsiveness**: Instant UI updates using **React Query** and optimized API polling.
- **User-Centric UX**: Intuitive controls for gate management and billing configuration.

## 🚀 Key Features
- **Live Gate Monitoring**: Real-time status of Entry/Exit gates with AI-detected license plate verification.
- **Dynamic Slot Tracking**: Visual representation of parking lot occupancy.
- **Billing Management**: Comprehensive tools to set and update parking fee structures.
- **History & Logs**: Detailed, searchable history of all vehicle movements.
- **Video Feed Integration**: Integrated proxy streams for live camera monitoring.

## 🛠️ Tech Stack
- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Data Fetching**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📦 Installation & Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

3. **Build for Production**
   ```bash
   npm run build
   ```

## 📂 Component Structure
- `/src/components`: Reusable UI components (Buttons, Cards, Modals).
- `/src/hooks`: Custom React hooks for API interaction and state.
- `/src/pages`: Main application views (Dashboard, History, Settings).
- `/src/services`: API client and data transformation logic.
- `/src/store`: Global state management using Zustand.
