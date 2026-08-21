#!/usr/bin/env bash

# ==============================================================================
# PingBin — Local Development Multi-Server Starter
# ==============================================================================
# Starts all services concurrently with multiplexed colored logs:
#   1. PingBin FastAPI Backend    -> http://localhost:8000
#   2. PingBin React Dashboard    -> http://localhost:5173
# ==============================================================================

# Determine root repository directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Define service paths
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# ANSI Color Codes
CYAN="\033[1;36m"
GREEN="\033[1;32m"
YELLOW="\033[1;33m"
MAGENTA="\033[1;35m"
BLUE="\033[1;34m"
RED="\033[1;31m"
BOLD="\033[1m"
NC="\033[0m" # No Color

# Track background process IDs
PIDS=()

# ── Cleanup & Graceful Shutdown Handler ───────────────────────────────────────
cleanup() {
  trap - SIGINT SIGTERM EXIT
  echo ""
  echo -e "${YELLOW}🛑 Shutting down all development servers...${NC}"
  
  for pid in "${PIDS[@]}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      # Terminate child processes first
      pkill -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done

  # Kill any remaining background subjobs
  kill $(jobs -p) 2>/dev/null || true
  wait 2>/dev/null || true
  
  echo -e "${GREEN}✅ All servers stopped successfully.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ── Pre-flight Checks ────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
echo "======================================================================"
echo "  🚀 PingBin — Starting All Development Servers"
echo "======================================================================"
echo -e "${NC}"

# Check for required frontend tools
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: Node.js is not installed or not in PATH.${NC}"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}❌ Error: npm is not installed or not in PATH.${NC}"
  exit 1
fi

# Determine backend start command
if command -v uv >/dev/null 2>&1; then
  BACKEND_CMD="AWS_PROFILE=aws PYTHONUNBUFFERED=1 PYTHONPATH=src uv run uvicorn server:app --host 0.0.0.0 --port 8000 --reload"
elif command -v python3 >/dev/null 2>&1; then
  BACKEND_CMD="AWS_PROFILE=aws PYTHONUNBUFFERED=1 PYTHONPATH=src python3 src/server.py"
else
  echo -e "${RED}❌ Error: Neither uv, uvicorn, nor python3 could be found for backend.${NC}"
  exit 1
fi

# Function to check frontend dependencies
check_frontend_dependencies() {
  local name="$1"
  local dir="$2"

  if [ ! -d "$dir" ]; then
    echo -e "${RED}❌ Error: Directory not found: $dir${NC}"
    exit 1
  fi

  if [ ! -d "$dir/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies in $name ($dir)...${NC}"
    (cd "$dir" && npm install)
  fi
}

# Function to check backend dependencies
check_backend_dependencies() {
  local name="$1"
  local dir="$2"

  if [ ! -d "$dir" ]; then
    echo -e "${RED}❌ Error: Directory not found: $dir${NC}"
    exit 1
  fi

  if command -v uv >/dev/null 2>&1; then
    if [ ! -d "$dir/.venv" ]; then
      echo -e "${YELLOW}📦 Syncing backend dependencies with uv in $name ($dir)...${NC}"
      (cd "$dir" && uv sync)
    fi
  fi
}

# Check port availability helper
check_port() {
  local port="$1"
  local service_name="$2"
  if command -v lsof >/dev/null 2>&1; then
    local pid
    pid=$(lsof -ti:"$port" 2>/dev/null | head -n 1)
    if [ -n "$pid" ]; then
      echo -e "${YELLOW}⚠️  Warning: Port $port ($service_name) is already in use by PID $pid.${NC}"
    fi
  fi
}

echo -e "${BLUE}🔍 Checking dependencies and ports...${NC}"
check_backend_dependencies "PingBin Backend" "$BACKEND_DIR"
check_frontend_dependencies "PingBin Frontend" "$FRONTEND_DIR"

check_port 8000 "Backend API"
check_port 5173 "Frontend UI"

echo ""
echo -e "${BOLD}📋 Active Service Endpoints:${NC}"
echo -e "  ⚙️  ${CYAN}1. Backend API (FastAPI & Webhook):${NC}  http://localhost:8000"
echo -e "  📚 ${MAGENTA}2. Backend Swagger API Docs:${NC}         http://localhost:8000/docs"
echo -e "  💻 ${GREEN}3. Frontend UI (Admin Dashboard):${NC}    http://localhost:5173"
echo ""
echo -e "${YELLOW}💡 Press [Ctrl + C] at any time to stop all servers simultaneously.${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo ""

# ── Service Launcher with Prefix Multiplexing ────────────────────────────────
start_service() {
  local label="$1"
  local color="$2"
  local dir="$3"
  local cmd="$4"

  (
    cd "$dir" || exit 1
    eval "$cmd" 2>&1 | while IFS= read -r line; do
      printf "${color}[%-12s]${NC} %s\n" "$label" "$line"
    done
  ) &
  
  PIDS+=($!)
}

# 1. Start PingBin FastAPI Backend (:8000)
start_service "BACKEND:8000" "$CYAN" "$BACKEND_DIR" "$BACKEND_CMD"

# 2. Start PingBin React Dashboard (:5173)
start_service "FRONTEND:5173" "$GREEN" "$FRONTEND_DIR" "npm run dev"

# Keep script running and wait for background processes
wait
