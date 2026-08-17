import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://exam-system-9sw5.onrender.com/api";
export const TOKEN_STORAGE_KEY = "examSeatSystem.token";
export const USER_STORAGE_KEY = "examSeatSystem.user";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the session token (if logged in) to every request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the session is invalid/expired — clear it and force back to
// the login screen rather than leaving the app in a broken half-logged-in state.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default client;
